/**
 * Data Service for Warehouse Stock Opname Bot
 * Integrates with Google Apps Script Web App with seamless published CSV fallback.
 * Configured with IPv4 priority to ensure reliable connectivity inside containers/WSL2.
 */

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
  'https://docs.google.com/spreadsheets/d/1_HvmBaEqFpOCBPXJuI4eMbhsKIDe5RhOrHo7h2kqt2c/export?format=csv&gid=1367299058';

// In-memory cache for CSV inventory to ensure instant responses
let cachedItems = [];
let lastCacheTime = 0;
const CACHE_TTL_MS = 25000; // 25 seconds

// Standard fallback credentials (matches Google Sheets User tab)
const LOCAL_ACCOUNTS = [
  { username: 'admin', pass: 'admin123', name: 'System Administrator', role: 'Admin' },
  { username: 'user1', pass: 'user123', name: 'Warehouse Operator', role: 'User' },
  { username: 'staff', pass: 'staff123', name: 'Warehouse Staff', role: 'User' }
];

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
    const qty = parseInt(item['qty'] || item['jumlah'] || '0', 10) || 0;
    const uom = String(item['uom'] || item['satuan'] || 'PCS').trim();
    const deskripsi = String(item['deskripsi'] || item['keterangan'] || '-').trim();
    const linkFoto = String(item['link foto'] || item['foto'] || '').trim();
    const fileId = extractDriveFileId(linkFoto);
    const no = parseInt(item['no'] || String(items.length + 1), 10) || (items.length + 1);

    if (!kode || kode === '-') {
      kode = `ITEM-${no}`;
    }

    if (kode || nama) {
      items.push({
        no: no,
        lokasiRak: rak,
        kodeMaterial: kode,
        namaBarang: nama,
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
 * Updates physical opname count in Google Sheets
 */
async function updateOpname(kode, qty, username) {
  const k = String(kode || '').trim();
  const q = parseInt(qty, 10);

  if (!k || isNaN(q) || q < 0) {
    return { success: false, error: 'Format: !opname <kode_material> <jumlah_stok_baru>' };
  }

  // Invalidate cache
  lastCacheTime = 0;

  try {
    const res = await httpClient.post(APPS_SCRIPT_URL, {
      action: 'opname',
      kode: k,
      qty: q,
      user: username || 'WhatsApp Operator'
    }, {
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      timeout: 10000
    });

    if (res.data && res.data.success) {
      // Update local cache if available
      const localItem = cachedItems.find(it => it.kodeMaterial.toLowerCase() === k.toLowerCase());
      if (localItem) localItem.qty = q;
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
 * Downloads image buffer from Google Drive or direct URL
 */
async function fetchImageBuffer(urlOrFileId) {
  if (!urlOrFileId) return null;
  const fileId = extractDriveFileId(urlOrFileId);

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
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      if (res.status === 200 && res.data && res.data.length > 200) {
        const contentType = res.headers['content-type'] || 'image/jpeg';
        if (contentType.includes('image') || contentType.includes('octet-stream')) {
          return {
            buffer: Buffer.from(res.data),
            mimeType: 'image/jpeg'
          };
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
  extractDriveFileId
};
