/**
 * Centralized Configuration for Google Apps Script Backend
 * Reads directly from native Google Apps Script Environment Variables (Script Properties).
 */

function getEnv(key, fallback) {
  try {
    const val = PropertiesService.getScriptProperties().getProperty(key);
    return (val !== null && val !== undefined && val !== '') ? val : (fallback || '');
  } catch (err) {
    return fallback || '';
  }
}

const CONFIG = {
  get SPREADSHEET_ID() {
    return getEnv('SPREADSHEET_ID', '1_HvmBaEqFpOCBPXJuI4eMbhsKIDe5RhOrHo7h2kqt2c');
  },
  get SHEET_NAME() {
    return getEnv('SHEET_NAME', 'PictFinder');
  },
  get DRIVE_FOLDER_ID() {
    return getEnv('DRIVE_FOLDER_ID', '1UoMPOvUXmj2Ao9AWSE1f4-eQ7WgrTkZz');
  },
  get API_KEY() {
    return getEnv('API_KEY', '');
  },
  get LOCK_TIMEOUT_MS() {
    return parseInt(getEnv('LOCK_TIMEOUT_MS', '30000'), 10) || 30000;
  },
  get USER_SHEET_NAME() {
    return getEnv('USER_SHEET_NAME', 'User');
  },
  get DEFAULT_ADMIN_HASH() {
    return getEnv('DEFAULT_ADMIN_HASH', '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9');
  },
  get DEFAULT_STAFF_HASH() {
    return getEnv('DEFAULT_STAFF_HASH', '10176e7b7b24d317acfcf8d2064cfd2f24e154f7b5a96603077d5ef813d6a6b6');
  },

  // Keywords used to dynamically detect column positions from sheet header row
  COLUMNS: {
    NO: ['no', 'nomor', 'number', '#'],
    LOKASI_RAK: ['lokasi rak', 'lokasi', 'rak', 'bin'],
    KODE_MATERIAL: ['kode material', 'kode', 'material code', 'part number', 'part no'],
    NAMA_BARANG: ['nama barang', 'nama', 'item name', 'description of goods', 'item'],
    QTY: ['qty', 'quantity', 'jumlah', 'stok'],
    UOM: ['uom', 'satuan', 'unit'],
    DESKRIPSI: ['deskripsi', 'description', 'keterangan', 'spesifikasi'],
    FOTO1: ['link foto', 'foto', 'link foto 1', 'foto 1', 'foto1', 'link1', 'gambar'],
    FOTO2: ['foto 2', 'foto2', 'link foto 2', 'link2'],
    FOTO_GABUNGAN: ['foto gabungan', 'fotogabungan', 'link gabungan', 'gabungan']
  }
};

/**
 * One-time setup utility to seed Google Apps Script Script Properties.
 * Can be run from the Apps Script editor or configured in Project Settings -> Script Properties.
 */
function initializeScriptProperties() {
  const props = PropertiesService.getScriptProperties();
  props.setProperties({
    SPREADSHEET_ID: '1_HvmBaEqFpOCBPXJuI4eMbhsKIDe5RhOrHo7h2kqt2c',
    SHEET_NAME: 'PictFinder',
    DRIVE_FOLDER_ID: '1UoMPOvUXmj2Ao9AWSE1f4-eQ7WgrTkZz',
    USER_SHEET_NAME: 'User',
    API_KEY: '',
    LOCK_TIMEOUT_MS: '30000',
    DEFAULT_ADMIN_HASH: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
    DEFAULT_STAFF_HASH: '10176e7b7b24d317acfcf8d2064cfd2f24e154f7b5a96603077d5ef813d6a6b6'
  });
  Logger.log('Script Properties (Environment Variables) successfully seeded!');
}
