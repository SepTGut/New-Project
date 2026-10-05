/**
 * Centralized Configuration for Warehouse Stock Opname System
 * Automatically reads and synchronizes with Google Apps Script Script Properties.
 */

function getEnv(key, fallback) {
  try {
    const props = PropertiesService.getScriptProperties();
    if (props) {
      const val = props.getProperty(key);
      if (val !== null && val !== undefined && val !== '') {
        return val;
      }
    }
  } catch (err) {
    // Silently fall back if running in restricted context (e.g. simple trigger)
  }
  return fallback || '';
}

const CONFIG = {
  get SPREADSHEET_ID() {
    return getEnv('SPREADSHEET_ID', '1_HvmBaEqFpOCBPXJuI4eMbhsKIDe5RhOrHo7h2kqt2c');
  },
  get DRIVE_FOLDER_ID() {
    return getEnv('DRIVE_FOLDER_ID', '1UoMPOvUXmj2Ao9AWSE1f4-eQ7WgrTkZz');
  },
  get LOGO_ID() {
    return getEnv('LOGO_ID', '');
  },
  get SHEET_OPNAME() {
    return getEnv('SHEET_OPNAME', 'Opname');
  },
  // Backward compatibility alias for any lingering references
  get SHEET_PICTFINDER() {
    return this.SHEET_OPNAME;
  },
  get SHEET_LOG() {
    return getEnv('SHEET_LOG', 'Log');
  },
  get SHEET_USER() {
    return getEnv('SHEET_USER', 'User');
  },
  get SHEET_TCARD() {
    return getEnv('SHEET_TCARD', 'Tcard');
  },
  get HEADER_ROW() {
    return 5;
  },
  get DATA_START_ROW() {
    return 6;
  },
  get TOTAL_COLS() {
    return 10;
  },
  get LOCK_TIMEOUT_MS() {
    return Number(getEnv('LOCK_TIMEOUT_MS', 30000)) || 30000;
  },

  // Column definitions for Opname (10 columns)
  COL: {
    NO: 1,
    LOKASI_RAK: 2,
    KODE_MATERIAL: 3,
    NAMA_BARANG: 4,
    MASUK: 5,
    KELUAR: 6,
    QTY: 7,
    UOM: 8,
    DESKRIPSI: 9,
    LINK_FOTO: 10
  }
};

/**
 * Helper to reliably get master inventory sheet (Opname or legacy PictFinder fallback)
 */
function getMasterSheet(ss) {
  if (!ss) ss = (typeof getSpreadsheetInstance === 'function') ? getSpreadsheetInstance() : SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_OPNAME);
  if (!sheet) {
    sheet = ss.getSheetByName('PictFinder');
  }
  return sheet;
}

/**
 * Print module configuration alias (matches KPMscript pattern)
 */
const PRINT = {
  get LOGO_ID() {
    return CONFIG.LOGO_ID;
  }
};

/**
 * Utility to pre-seed Script Properties on demand
 */
function initializeScriptProperties() {
  const props = PropertiesService.getScriptProperties();
  props.setProperties({
    SPREADSHEET_ID: '1_HvmBaEqFpOCBPXJuI4eMbhsKIDe5RhOrHo7h2kqt2c',
    DRIVE_FOLDER_ID: '1UoMPOvUXmj2Ao9AWSE1f4-eQ7WgrTkZz',
    LOGO_ID: '',
    SHEET_OPNAME: 'Opname',
    SHEET_LOG: 'Log',
    SHEET_USER: 'User',
    SHEET_TCARD: 'Tcard'
  });
  Logger.log('Script Properties initialized successfully!');
}
