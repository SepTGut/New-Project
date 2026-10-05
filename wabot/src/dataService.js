/**
 * Data Service for Warehouse Stock Opname Bot
 * Integrates with Google Apps Script Web App with seamless published CSV fallback.
 * Configured with IPv4 priority to ensure reliable connectivity inside containers/WSL2.
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const http = require('http');
const https = require('https');
const dns = require('dns');
require('dotenv').config();

// Enforce IPv4 lookup first to prevent WSL2/Docker IPv6 timeouts (ENETUNREACH)
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

const httpClient = axios.create({
  httpAgent: new http.Agent({ family: 4, keepAlive: true }),
  httpsAgent: new https.Agent({ family: 4, keepAlive: true }),
  timeout: 10000
});

const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL ||
  'https://script.google.com/macros/s/AKfycbyLDBXj86JNfidv5tgnryVygaEsbsuPePuOtVN7O2iYA4DE8dR2In5j2xfuuWU3AGOK/exec';

const DATABASE_CSV_URL = process.env.DATABASE_CSV_URL ||
  'https://docs.google.com/spreadsheets/d/1_HvmBaEqFpOCBPXJuI4eMbhsKIDe5RhOrHo7h2kqt2c/gviz/tq?tqx=out:csv&sheet=Opname';

// In-memory cache for CSV inventory to ensure instant responses
let cachedItems = [];
let lastCacheTime = 0;
const CACHE_TTL_MS = 25000; // 25 seconds

// Standard fallback credentials (matches Google Sheets User tab)
const LOCAL_ACCOUNTS = [
  { username: 'admin',    pass: 'admin123', name: 'System Administrator',        role: 'Admin' },
  { username: 'user1',   pass: 'user123',  name: 'Warehouse Operator',           role: 'User'  },
  { username: 'staff',   pass: 'staff123', name: 'Warehouse Staff',              role: 'User'  },
  { username: 'iit_lead', pass: 'iit2026!', name: 'IT Support & Systems (Hidden)', role: 'IIT'  }
];

// In-memory cache for downloaded image buffers to ensure lightning-fast WhatsApp replies
const imageBufferCache = new Map();
const IMG_CACHE_TTL = 3600000; // 1 hour

// Google Drive photo reference maps
const photoCatalogByNo = new Map();
const photoCatalogByCode = new Map();
const photoCatalogByName = new Map();

/**
 * Initializes Google Drive photo reference catalog from exported JSON
 */
function initDrivePhotoCatalog() {
  const candidates = [
    path.join(__dirname, '../../data/exported_source_inventory.json'),
    path.join(__dirname, '../data/exported_source_inventory.json'),
    path.join(__dirname, '../../data/ppo/exported_source_inventory.json'),
    path.join(process.env.DATA_DIR || '', 'exported_source_inventory.json'),
    path.join(process.cwd(), 'data/exported_source_inventory.json'),
    path.join(process.cwd(), '../data/exported_source_inventory.json'),
    '/app/data/exported_source_inventory.json'
  ];

  let catalogPath = null;
  for (const c of candidates) {
    if (c && fs.existsSync(c)) {
      catalogPath = c;
      break;
    }
  }

  if (!catalogPath) {
    return;
  }

  try {
    const raw = fs.readFileSync(catalogPath, 'utf8');
    const json = JSON.parse(raw);
    const items = json.items || [];
    for (const it of items) {
      const url = it.link_foto || '';
      if (!url) continue;

      if (it.no) {
        photoCatalogByNo.set(String(it.no), url);
      }
      const kode = String(it.kode_material || '').trim().toLowerCase();
      if (kode && kode !== '-') {
        photoCatalogByCode.set(kode, url);
        photoCatalogByCode.set(kode.replace(/[^a-z0-9]/g, ''), url);
      }
      const nama = String(it.nama_barang || '').trim().toLowerCase();
      if (nama) {
        photoCatalogByName.set(nama, url);
        photoCatalogByName.set(nama.replace(/[^a-z0-9]/g, ''), url);
      }
    }
  } catch (err) {
    console.error('[dataService] Error loading Google Drive photo catalog:', err.message);
  }
}

initDrivePhotoCatalog();

/**
 * Resolves Google Drive photo URL and File ID from catalog
 */
function resolveDrivePhoto(no, kode, nama) {
  if (photoCatalogByNo.size === 0) initDrivePhotoCatalog();

  // 1. Match by No
  if (no && photoCatalogByNo.has(String(no))) {
    const url = photoCatalogByNo.get(String(no));
    return { url, fileId: extractDriveFileId(url) };
  }

  // 2. Match by Code
  const cleanCode = String(kode || '').trim().toLowerCase();
  if (cleanCode && cleanCode !== '-') {
    if (photoCatalogByCode.has(cleanCode)) {
      const url = photoCatalogByCode.get(cleanCode);
      return { url, fileId: extractDriveFileId(url) };
    }
    const stripped = cleanCode.replace(/[^a-z0-9]/g, '');
    if (photoCatalogByCode.has(stripped)) {
      const url = photoCatalogByCode.get(stripped);
      return { url, fileId: extractDriveFileId(url) };
    }
  }

  // 3. Match by Name
  const cleanName = String(nama || '').trim().toLowerCase();
  if (cleanName) {
    if (photoCatalogByName.has(cleanName)) {
      const url = photoCatalogByName.get(cleanName);
      return { url, fileId: extractDriveFileId(url) };
    }
    const strippedName = cleanName.replace(/[^a-z0-9]/g, '');
    if (photoCatalogByName.has(strippedName)) {
      const url = photoCatalogByName.get(strippedName);
      return { url, fileId: extractDriveFileId(url) };
    }
  }

  return null;
}

/**
 * Extracts Google Drive file ID from any URL format
 */
function extractDriveFileId(str) {
  if (!str) return '';
  const s = String(str);
  const m1 = s.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m1 && m1[1]) return m1[1];
  const m2 = s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (m2 && m2[1]) return m2[1];
  if (/^[a-zA-Z0-9_-]{25,}$/.test(s)) return s;
  return '';
}

/**
 * Parses simple CSV string into array of objects
 */
function parseCsv(csvText) {
  if (!csvText) return [];
  const lines = csvText.split(/\r?\n/).filter(line => line.trim().length > 0);
  
  // Find header row containing "kode material" or "nama barang"
  let headerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].toLowerCase();
    if (l.includes('kode material') || l.includes('nama barang')) {
      headerIndex = i;
      break;
    }
  }

  if (headerIndex === -1) return [];

  // Parse CSV lines taking into account quoted fields
  const parseLine = (line) => {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += char;
      }
    }
    result.push(cur.trim());
    return result;
  };

  const headers = parseLine(lines[headerIndex]).map(h => h.toLowerCase());
  const items = [];

  for (let i = headerIndex + 1; i < lines.length; i++) {
    const row = parseLine(lines[i]);
    if (row.length < 3) continue;

    const item = {};
    headers.forEach((h, idx) => {
      item[h] = row[idx] || '';
    });

    let kode = String(item['kode material'] || item['kode'] || '').trim();
    const nama = String(item['nama barang'] || item['nama'] || '').trim();
    const rak = String(item['lokasi rak'] || item['rak'] || item['lokasi'] || '-').trim();
    const masuk = parseInt(item['masuk'] || '0', 10) || 0;
    const keluar = parseInt(item['keluar'] || '0', 10) || 0;
    const qty = parseInt(item['qty'] || item['jumlah'] || '0', 10) || 0;
    const uom = String(item['uom'] || item['satuan'] || 'PCS').trim();
    const deskripsi = String(item['deskripsi'] || item['keterangan'] || '-').trim();
    let linkFoto = String(item['link foto'] || item['foto'] || '').trim();
    let fileId = extractDriveFileId(linkFoto);
    const no = parseInt(item['no'] || item['stock opname gudang no'] || String(items.length + 1), 10) || (items.length + 1);

    if (!kode || kode === '-') {
      kode = `ITEM-${no}`;
    }

    // Resolve Google Drive Photo Link if linkFoto is literal 'Link' or empty
    if (!fileId || linkFoto.toLowerCase() === 'link') {
      const resolved = resolveDrivePhoto(no, kode, nama);
      if (resolved) {
        linkFoto = resolved.url;
        fileId = resolved.fileId;
      }
    }

    if (kode || nama) {
      items.push({
        no: no,
        lokasiRak: rak,
        kodeMaterial: kode,
        namaBarang: nama,
        masuk: masuk,
        keluar: keluar,
        qty: qty,
        uom: uom,
        deskripsi: deskripsi,
        linkFoto: linkFoto,
        fileId: fileId,
        imageUrl: fileId ? `https://lh3.googleusercontent.com/d/${fileId}` : ''
      });
    }
  }

  return items;
}

/**
 * Retrieves all inventory items, cached in memory
 */
async function getAllInventoryItems() {
  if (cachedItems.length > 0 && (Date.now() - lastCacheTime < CACHE_TTL_MS)) {
    return cachedItems;
  }
  try {
    const csvRes = await httpClient.get(`${DATABASE_CSV_URL}&_t=${Date.now()}`, {
      timeout: 8000
    });
    if (csvRes.status === 200 && csvRes.data) {
      const allItems = parseCsv(csvRes.data);
      if (allItems.length > 0) {
        cachedItems = allItems;
        lastCacheTime = Date.now();
        return cachedItems;
      }
    }
  } catch (err) {
    console.error('Error fetching CSV inventory fallback:', err.message);
  }
  return cachedItems;
}

/**
 * Filters items using intelligent multi-token and multi-field matching
 */
function filterItems(items, query) {
  const cleanQ = String(query || '').trim().toLowerCase();
  if (!cleanQ) return items.slice(0, 30);
  if (cleanQ === '*' || cleanQ === 'all' || cleanQ === 'semua') return items;

  // Split query into tokens by whitespace, commas, slashes, or hyphens
  const tokens = cleanQ.split(/[\s,;|/]+/).filter(Boolean);
  if (tokens.length === 0) return items.slice(0, 30);

  const cleanStripped = cleanQ.replace(/[^a-z0-9]/g, '');
  const scored = [];

  for (const item of items) {
    const kode = String(item.kodeMaterial || '').toLowerCase();
    const nama = String(item.namaBarang || '').toLowerCase();
    const rak = String(item.lokasiRak || '').toLowerCase();
    const desk = String(item.deskripsi || '').toLowerCase();
    const uom = String(item.uom || '').toLowerCase();
    const noStr = String(item.no || '');

    const combined = `${noStr} #${noStr} ${kode} ${nama} ${rak} ${desk} ${uom}`.toLowerCase();
    const strippedCombined = combined.replace(/[^a-z0-9]/g, '');

    // Exact matches
    const isExactCode = (kode === cleanQ) || (kode.replace(/[^a-z0-9]/g, '') === cleanStripped);
    const isExactNo = (noStr === cleanQ) || (`#${noStr}` === cleanQ);
    const isExactNama = (nama === cleanQ);

    // Multi-token match: every token must be found in combined text or stripped version
    const allTokensMatch = tokens.every(token => {
      if (combined.includes(token)) return true;
      const strippedToken = token.replace(/[^a-z0-9]/g, '');
      if (strippedToken && strippedCombined.includes(strippedToken)) return true;
      return false;
    });

    if (isExactCode || isExactNo || isExactNama) {
      scored.push({ item, score: 100 });
    } else if (allTokensMatch) {
      let score = 10;
      if (nama.startsWith(tokens[0]) || kode.startsWith(tokens[0])) score += 15;
      if (nama.includes(cleanQ) || kode.includes(cleanQ)) score += 10;
      scored.push({ item, score });
    }
  }

  // Sort by highest score first, then by sequence number
  scored.sort((a, b) => b.score - a.score || (a.item.no - b.item.no));
  return scored.map(s => s.item);
}

/**
 * Searches items by query keyword across all fields
 */
async function searchItems(query) {
  const cleanQ = String(query || '').trim().toLowerCase();

  // 1. First, search using local cached/fetched inventory with smart ranking
  const items = await getAllInventoryItems();
  if (items && items.length > 0) {
    const matched = filterItems(items, cleanQ);
    if (matched.length > 0) return matched;
  }

  // 2. Fallback to Google Apps Script API endpoint
  try {
    const res = await httpClient.get(`${APPS_SCRIPT_URL}?action=search&q=${encodeURIComponent(cleanQ)}`, {
      timeout: 5000
    });
    if (res.data && res.data.success && Array.isArray(res.data.items) && res.data.items.length > 0) {
      return res.data.items;
    }
  } catch (err) {
    // Silently continue
  }

  return [];
}

/**
 * Retrieves a single item by code, number, or exact name
 */
async function getItemByCode(kode) {
  const cleanKode = String(kode || '').trim().toLowerCase();
  if (!cleanKode) return null;

  const cleanStripped = cleanKode.replace(/[^a-z0-9]/g, '');
  const matches = await searchItems(cleanKode);

  if (matches && matches.length > 0) {
    const exact = matches.find(m => {
      const k = String(m.kodeMaterial || '').toLowerCase();
      const n = String(m.no || '');
      return k === cleanKode ||
        k.replace(/[^a-z0-9]/g, '') === cleanStripped ||
        n === cleanKode ||
        `#${n}` === cleanKode;
    });
    return exact || matches[0];
  }

  // Fallback to Apps Script check
  try {
    const res = await httpClient.get(`${APPS_SCRIPT_URL}?action=check&kode=${encodeURIComponent(cleanKode)}`, {
      timeout: 5000
    });
    if (res.data && res.data.success && res.data.item) {
      return res.data.item;
    }
  } catch (e) {}

  return null;
}

/**
 * Normalizes phone numbers to canonical international format without plus (e.g. 628123456789)
 */
function normalizePhone(phone) {
  if (!phone) return '';
  let str = String(phone).trim();
  str = str.split('@')[0].split(':')[0];
  str = str.replace(/[^\d+]/g, '');
  if (str.startsWith('+')) {
    str = str.substring(1);
  }
  if (str.startsWith('0')) {
    str = '62' + str.substring(1);
  } else if (str.startsWith('8')) {
    str = '62' + str;
  }
  return str;
}

// In-memory phone number to user mapping cache (TTL: 5 minutes)
let cachedPhoneMappings = new Map(); // phone -> user object
let lastPhoneCacheTime = 0;
const PHONE_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Refreshes phone number mappings from Google Apps Script
 */
async function refreshPhoneCache(force = false) {
  if (!force && cachedPhoneMappings.size > 0 && (Date.now() - lastPhoneCacheTime) < PHONE_CACHE_TTL_MS) {
    return cachedPhoneMappings;
  }

  try {
    const res = await httpClient.post(APPS_SCRIPT_URL, {
      action: 'get_all_phone_users'
    }, {
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      timeout: 7000
    });

    if (res.data && res.data.success && Array.isArray(res.data.list)) {
      const newMap = new Map();
      for (const item of res.data.list) {
        const cleanP = normalizePhone(item.phone);
        if (cleanP) {
          newMap.set(cleanP, {
            phone: cleanP,
            username: item.username,
            name: item.name || item.username,
            role: item.role || 'User',
            email: item.email || '',
            status: item.status || 'Active'
          });
        }
      }
      cachedPhoneMappings = newMap;
      lastPhoneCacheTime = Date.now();
      return cachedPhoneMappings;
    }
  } catch (err) {
    // Silently continue if GAS request fails
  }

  return cachedPhoneMappings;
}

/**
 * Looks up user by registered WhatsApp phone number
 */
async function getUserByPhone(phoneNumber) {
  const cleanPhone = normalizePhone(phoneNumber);
  if (!cleanPhone) {
    return { success: false, error: 'Nomor telepon tidak valid.' };
  }

  // 1. Check in-memory phone cache first for instant auto-login
  if (cachedPhoneMappings.size === 0 || (Date.now() - lastPhoneCacheTime) >= PHONE_CACHE_TTL_MS) {
    await refreshPhoneCache();
  }

  if (cachedPhoneMappings.has(cleanPhone)) {
    return {
      success: true,
      user: cachedPhoneMappings.get(cleanPhone)
    };
  }

  // 2. Direct online check against Apps Script
  try {
    const res = await httpClient.post(APPS_SCRIPT_URL, {
      action: 'get_user_by_phone',
      phone: cleanPhone
    }, {
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      timeout: 6000
    });

    if (res.data && res.data.success && res.data.user) {
      cachedPhoneMappings.set(cleanPhone, res.data.user);
      return { success: true, user: res.data.user };
    } else if (res.data && res.data.error) {
      return { success: false, error: res.data.error };
    }
  } catch (err) {}

  return { success: false, error: 'Nomor telepon belum terdaftar.' };
}

/**
 * Registers / binds a phone number to an existing user account in Google Sheets
 */
async function addPhoneToUser(username, phoneNumber) {
  const u = String(username || '').trim();
  const p = normalizePhone(phoneNumber);

  if (!u || !p) {
    return { success: false, error: 'Username dan nomor telepon wajib diisi.' };
  }

  try {
    const res = await httpClient.post(APPS_SCRIPT_URL, {
      action: 'add_phone',
      username: u,
      phone: p
    }, {
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      timeout: 8000
    });

    if (res.data) {
      if (res.data.success) {
        // Refresh cache immediately
        await refreshPhoneCache(true);
      }
      return res.data;
    }
  } catch (err) {
    return { success: false, error: `Gagal menghubungi spreadsheet: ${err.message}` };
  }

  return { success: false, error: 'Terjadi kesalahan saat mendaftarkan nomor telepon.' };
}

/**
 * Removes a phone number from Google Sheets
 */
async function removePhone(phoneNumber) {
  const p = normalizePhone(phoneNumber);
  if (!p) {
    return { success: false, error: 'Nomor telepon wajib diisi.' };
  }

  try {
    const res = await httpClient.post(APPS_SCRIPT_URL, {
      action: 'remove_phone',
      phone: p
    }, {
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      timeout: 8000
    });

    if (res.data) {
      if (res.data.success) {
        // Invalidate in cache
        cachedPhoneMappings.delete(p);
        await refreshPhoneCache(true);
      }
      return res.data;
    }
  } catch (err) {
    return { success: false, error: `Gagal menghubungi spreadsheet: ${err.message}` };
  }

  return { success: false, error: 'Terjadi kesalahan saat menghapus nomor telepon.' };
}

/**
 * Verifies user credentials
 */
async function verifyLogin(username, password) {
  const u = String(username || '').trim();
  const p = String(password || '').trim();

  if (!u || !p) {
    return { success: false, error: 'Format: !login <username> <password>' };
  }

  // 1. Try Google Apps Script API
  try {
    const res = await httpClient.post(APPS_SCRIPT_URL, {
      action: 'login',
      username: u,
      password: p
    }, {
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      timeout: 6000
    });
    if (res.data && res.data.success && res.data.user) {
      return { success: true, user: res.data.user };
    } else if (res.data && res.data.error) {
      return { success: false, error: res.data.error };
    }
  } catch (err) {}

  // 2. Fallback against standard accounts
  const match = LOCAL_ACCOUNTS.find(
    acc => acc.username.toLowerCase() === u.toLowerCase() && acc.pass === p
  );
  if (match) {
    return {
      success: true,
      user: {
        username: match.username,
        name: match.name,
        role: match.role
      }
    };
  }

  return { success: false, error: 'Username atau password salah.' };
}

/**
 * Updates physical opname count and/or material photo in Google Sheets
 * @param {string} kode - Material code or item-N
 * @param {string|number|null} qty - Absolute count, delta ("+1", "-1"), or null (photo-only)
 * @param {string} username - Name of user recording opname
 * @param {string|null} imageBase64 - Base64 encoded JPEG/PNG image data (optional)
 */
async function updateOpname(kode, qty, username, imageBase64) {
  const k = String(kode || '').trim();
  const qStr = (qty !== null && qty !== undefined && String(qty).trim() !== '') ? String(qty).trim() : null;
  const b64 = imageBase64 && typeof imageBase64 === 'string' ? imageBase64.trim() : null;

  if (!k) {
    return { success: false, error: 'Kode material wajib diisi.' };
  }
  if (qStr === null && !b64) {
    return { success: false, error: 'Jumlah stok (qty) atau foto material wajib disertakan.' };
  }

  // Invalidate cache
  lastCacheTime = 0;

  try {
    const payload = {
      action: 'opname',
      kode: k,
      qty: qStr,
      user: username || 'WhatsApp Operator'
    };
    if (b64) {
      payload.imageBase64 = b64;
    }

    const res = await httpClient.post(APPS_SCRIPT_URL, payload, {
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      timeout: 25000 // Allow extra time for image upload to Google Drive
    });

    if (res.data && res.data.success) {
      // Update local cache if available
      const localItem = cachedItems.find(it => it.kodeMaterial.toLowerCase() === k.toLowerCase());
      if (localItem && res.data.newQty !== undefined) {
        localItem.qty = res.data.newQty;
      }
      if (localItem && res.data.totalMasuk !== undefined) {
        localItem.masuk = res.data.totalMasuk;
      }
      if (localItem && res.data.totalKeluar !== undefined) {
        localItem.keluar = res.data.totalKeluar;
      }
      if (localItem && res.data.imageUrl) {
        localItem.imageUrl = res.data.imageUrl;
      }
      return res.data;
    }
    return { success: false, error: (res.data && res.data.error) || 'Gagal memperbarui stok di Google Sheets.' };
  } catch (err) {
    return { success: false, error: 'Gagal menghubungi server database: ' + err.message };
  }
}

/**
 * Registers new material in Google Sheets
 */
async function addMaterial(data, username) {
  lastCacheTime = 0;
  try {
    const res = await httpClient.post(APPS_SCRIPT_URL, {
      action: 'add',
      ...data,
      user: username || 'WhatsApp Admin'
    }, {
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      timeout: 12000
    });

    if (res.data && res.data.success) {
      return res.data;
    }
    return { success: false, error: (res.data && res.data.error) || 'Gagal menambahkan material baru.' };
  } catch (err) {
    return { success: false, error: 'Gagal menghubungi server database: ' + err.message };
  }
}

/**
 * Downloads image buffer from Google Drive or direct URL with caching
 */
async function fetchImageBuffer(urlOrFileId) {
  if (!urlOrFileId) return null;
  const fileId = extractDriveFileId(urlOrFileId);

  // Check in-memory buffer cache
  if (fileId && imageBufferCache.has(fileId)) {
    const cached = imageBufferCache.get(fileId);
    if (Date.now() - cached.timestamp < IMG_CACHE_TTL) {
      return { buffer: cached.buffer, mimeType: cached.mimeType };
    }
  }

  const urlsToTry = [];
  if (fileId) {
    urlsToTry.push(`https://lh3.googleusercontent.com/d/${fileId}`);
    urlsToTry.push(`https://drive.google.com/thumbnail?id=${fileId}&sz=w1000`);
    urlsToTry.push(`https://drive.google.com/uc?export=download&id=${fileId}`);
  } else if (String(urlOrFileId).startsWith('http')) {
    urlsToTry.push(urlOrFileId);
  }

  for (const url of urlsToTry) {
    try {
      const res = await httpClient.get(url, {
        responseType: 'arraybuffer',
        timeout: 12000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      if (res.status === 200 && res.data && res.data.length > 200) {
        const contentType = res.headers['content-type'] || 'image/jpeg';
        if (contentType.includes('image') || contentType.includes('octet-stream')) {
          const result = {
            buffer: Buffer.from(res.data),
            mimeType: 'image/jpeg'
          };
          if (fileId) {
            imageBufferCache.set(fileId, { ...result, timestamp: Date.now() });
          }
          return result;
        }
      }
    } catch (e) {}
  }
  return null;
}

module.exports = {
  searchItems,
  getItemByCode,
  verifyLogin,
  updateOpname,
  addMaterial,
  fetchImageBuffer,
  extractDriveFileId,
  resolveDrivePhoto,
  normalizePhone,
  getUserByPhone,
  addPhoneToUser,
  removePhone,
  refreshPhoneCache
};
