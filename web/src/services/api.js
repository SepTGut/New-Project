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
          complete: (results) => {
            if (results.data && results.data.length > 0) {
              localStorage.setItem(OFFLINE_CACHE_KEY, JSON.stringify(results.data));
            }
            resolve(results.data);
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
