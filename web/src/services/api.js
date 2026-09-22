import Papa from 'papaparse';

const DATABASE_URL = import.meta.env.VITE_DATABASE_URL ||
  'https://docs.google.com/spreadsheets/d/1_HvmBaEqFpOCBPXJuI4eMbhsKIDe5RhOrHo7h2kqt2c/export?format=csv&gid=1367299058';

const APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL ||
  'https://script.google.com/macros/s/AKfycbyLDBXj86JNfidv5tgnryVygaEsbsuPePuOtVN7O2iYA4DE8dR2In5j2xfuuWU3AGOK/exec';

const API_KEY = import.meta.env.VITE_API_KEY || '';
const OFFLINE_CACHE_KEY = 'cached_stock_inventory';

/**
 * Strips top title/empty rows from Google Sheets CSV exports so Papa.parse finds the true header row
 */
function prepareCsvText(csvText) {
  if (!csvText) return '';
  const lines = csvText.split(/\r?\n/);
  const headerIdx = lines.findIndex((line) => {
    const l = line.toLowerCase();
    return l.includes('kode material') || l.includes('nama barang') || l.includes('lokasi rak');
  });
  if (headerIdx !== -1) {
    return lines.slice(headerIdx).join('\n');
  }
  return csvText;
}

/**
 * Fetches latest inventory.
 * 1. Tries Apps Script doGet?action=inventory for 0-second real-time sync.
 * 2. Falls back to published CSV URL.
 * 3. Falls back to offline localStorage cache.
 */
export async function fetchInventory() {
  const cacheBuster = `_t=${Date.now()}`;

  // Strategy 1: Real-time JSON from Google Apps Script
  try {
    const liveUrl = `${APPS_SCRIPT_URL}?action=inventory&${cacheBuster}`;
    const liveResp = await fetch(liveUrl, { method: 'GET' });
    if (liveResp.ok) {
      const liveJson = await liveResp.json();
      if (liveJson && liveJson.success && Array.isArray(liveJson.data)) {
        localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify(liveJson.data));
        return liveJson.data;
      }
    }
  } catch (gasErr) {
    console.warn('Apps Script live sync unavailable, falling back to published CSV:', gasErr);
  }

let gdriveCatalog = null;
async function getGdriveCatalog() {
  if (gdriveCatalog) return gdriveCatalog;
  try {
    const res = await fetch('/exported_source_inventory.json');
    if (res.ok) {
      const json = await res.json();
      gdriveCatalog = Array.isArray(json) ? json : (json.items || []);
    }
  } catch (e) {
    // Ignore if not available
  }
  return gdriveCatalog || [];
}

  // Strategy 2: Published Google Sheets CSV fallback
  try {
    const csvUrl = `${DATABASE_URL}&${cacheBuster}`;
    const csvResp = await fetch(csvUrl);
    if (csvResp.ok) {
      const csvText = await csvResp.text();
      const cleanCsv = prepareCsvText(csvText);
      return new Promise((resolve) => {
        Papa.parse(cleanCsv, {
          header: true,
          skipEmptyLines: true,
          complete: async (results) => {
            let data = results.data || [];
            if (data.length > 0) {
              try {
                const catalog = await getGdriveCatalog();
                if (catalog && catalog.length > 0) {
                  const catByNo = new Map();
                  const catByCode = new Map();
                  const catByName = new Map();

                  catalog.forEach((c) => {
                    const link = c.link_foto || c.linkFoto || '';
                    if (!link) return;
                    const match = String(link).match(/(?:\/d\/|id=)([a-zA-Z0-9_-]+)/);
                    const fileId = match ? match[1] : '';
                    const imageUrl = fileId ? ('https://lh3.googleusercontent.com/d/' + fileId) : link;
                    const entry = { linkFoto: link, fileId, imageUrl };

                    if (c.no) catByNo.set(String(c.no), entry);
                    const code = String(c.kode_material || c.kodeMaterial || '').trim().toLowerCase();
                    if (code && code !== '-') {
                      catByCode.set(code, entry);
                      catByCode.set(code.replace(/[^a-z0-9]/g, ''), entry);
                    }
                    const name = String(c.nama_barang || c.namaBarang || '').trim().toLowerCase();
                    if (name) {
                      catByName.set(name, entry);
                      catByName.set(name.replace(/[^a-z0-9]/g, ''), entry);
                    }
                  });

                  data = data.map((it) => {
                    const no = String(it.No || it.no || it['NO'] || '').trim();
                    const code = String(it['Kode Material'] || it.kodeMaterial || it['kode'] || '').trim().toLowerCase();
                    const name = String(it['Nama Barang'] || it.namaBarang || it['nama'] || '').trim().toLowerCase();

                    const matched = (no && catByNo.get(no)) ||
                                    (code && code !== '-' && (catByCode.get(code) || catByCode.get(code.replace(/[^a-z0-9]/g, '')))) ||
                                    (name && (catByName.get(name) || catByName.get(name.replace(/[^a-z0-9]/g, ''))));

                    if (matched) {
                      const currentLink = String(it['Link Foto'] || it.linkFoto || '').trim();
                      if (!currentLink || currentLink.toLowerCase() === 'link' || currentLink === '-') {
                        return {
                          ...it,
                          'Link Foto': matched.linkFoto,
                          linkFoto: matched.linkFoto,
                          fileId: matched.fileId,
                          imageUrl: matched.imageUrl
                        };
                      }
                    }
                    return it;
                  });
                }
              } catch (e) {}
              localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify(data));
            }
            resolve(data);
          },
          error: () => resolve(getCachedInventory())
        });
      });
    }
  } catch (csvErr) {
    console.warn('Published CSV fetch failed, falling back to offline cache:', csvErr);
  }

  // Strategy 3: Offline localStorage Cache
  return getCachedInventory();
}

export function getCachedInventory() {
  const cached = localStorage.getItem(OFFLINE_CACHE_KEY);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      return [];
    }
  }
  return [];
}

/**
 * Dispatches an API call to Google Apps Script Web App
 */
async function callAppsScript(payload) {
  if (API_KEY) {
    payload.apiKey = API_KEY;
  }

  const response = await fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain;charset=utf-8' // Avoids CORS preflight OPTIONS in GAS
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    throw new Error(`Koneksi server gagal (${response.status})`);
  }

  const data = await response.json();
  return data;
}

/**
 * Authenticates user credentials against the "Users" sheet
 */
export async function authenticateViaApi(username, passwordHash, password) {
  const payload = {
    action: 'login',
    username: username,
    password: password,
    passwordHash: passwordHash
  };
  return await callAppsScript(payload);
}

/**
 * Submits a new inventory record
 */
export async function submitNewItem(itemData) {
  const payload = {
    action: 'add',
    lokasiRak: itemData.lokasiRak,
    kodeMaterial: itemData.kodeMaterial,
    namaBarang: itemData.namaBarang,
    qty: itemData.qty,
    uom: itemData.uom,
    deskripsi: itemData.deskripsi,
    foto1: itemData.foto1,
    foto2: itemData.foto2,
    fotoGabungan: itemData.fotoGabungan
  };

  return await callAppsScript(payload);
}

/**
 * Updates an existing inventory record
 */
export async function submitUpdateItem(itemData) {
  const payload = {
    action: 'update',
    kodeMaterialAsli: itemData.kodeMaterialAsli,
    lokasiRak: itemData.lokasiRak,
    kodeMaterial: itemData.kodeMaterial,
    namaBarang: itemData.namaBarang,
    qty: itemData.qty,
    uom: itemData.uom,
    deskripsi: itemData.deskripsi,
    foto1: itemData.foto1,
    foto2: itemData.foto2,
    keepFoto1: itemData.keepFoto1,
    keepFoto2: itemData.keepFoto2,
    fotoGabungan: itemData.fotoGabungan,
    keepFotoGabungan: itemData.keepFotoGabungan
  };

  return await callAppsScript(payload);
}
