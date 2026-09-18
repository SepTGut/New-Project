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
  get SHEET_PICTFINDER() {
    return getEnv('SHEET_PICTFINDER', 'PictFinder');
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

  // Column definitions for PictFinder (8 columns)
  COL: {
    NO: 1,
    LOKASI_RAK: 2,
    KODE_MATERIAL: 3,
    NAMA_BARANG: 4,
    QTY: 5,
    UOM: 6,
    DESKRIPSI: 7,
    LINK_FOTO: 8
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
    SHEET_PICTFINDER: 'PictFinder',
    SHEET_USER: 'User',
    SHEET_TCARD: 'Tcard'
  });
  Logger.log('Script Properties initialized successfully!');
}
