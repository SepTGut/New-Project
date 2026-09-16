/**
 * Centralized Configuration for Google Apps Script Backend
 */
const CONFIG = {
  SPREADSHEET_ID: '1SyeWtAjKAFyDs8oDVxKhiQluF45JjB_Se79PjmfrQxQ',
  SHEET_NAME: 'PictFinder',
  DRIVE_FOLDER_ID: '1UoMPOvUXmj2Ao9AWSE1f4-eQ7WgrTkZz',

  // Optional API Key for securing endpoints.
  // Leave empty to allow backward-compatible unauthenticated requests.
  API_KEY: '',

  // Concurrency lock timeout (milliseconds)
  LOCK_TIMEOUT_MS: 30000,

  // Keywords used to dynamically detect column positions from sheet header row
  COLUMNS: {
    LOKASI_RAK: ['lokasi rak', 'lokasi', 'rak'],
    KODE_MATERIAL: ['kode material', 'kode', 'material code'],
    NAMA_BARANG: ['nama barang', 'nama', 'item name'],
    QTY: ['qty', 'quantity', 'jumlah'],
    UOM: ['uom', 'satuan', 'unit'],
    DESKRIPSI: ['deskripsi', 'description', 'keterangan'],
    FOTO1: ['foto 1', 'foto1', 'link foto 1', 'link1'],
    FOTO2: ['foto 2', 'foto2', 'link foto 2', 'link2'],
    FOTO_GABUNGAN: ['foto gabungan', 'fotogabungan', 'link gabungan', 'gabungan']
  },

  // Users sheet configuration for dynamic authentication
  USER_SHEET_NAME: 'Users',
  DEFAULT_ADMIN_HASH: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9', // admin123
  DEFAULT_STAFF_HASH: '10176e7b7b24d317acfcf8d2064cfd2f24e154f7b5a96603077d5ef813d6a6b6'  // staff123
};
