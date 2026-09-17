/**
 * Centralized Configuration for Warehouse Stock Opname System
 * Automatically reads and synchronizes with Google Apps Script Script Properties.
 */

function getEnv(key, fallback) {
  try {
    const props = PropertiesService.getScriptProperties();
    let val = props.getProperty(key);
    if (val !== null && val !== undefined && val !== '') {
      return val;
    }
    if (fallback) {
      props.setProperty(key, String(fallback));
    }
    return fallback || '';
  } catch (err) {
    return fallback || '';
  }
}

const CONFIG = {
  get SPREADSHEET_ID() {
    return getEnv('SPREADSHEET_ID', '1_HvmBaEqFpOCBPXJuI4eMbhsKIDe5RhOrHo7h2kqt2c');
  },
  get DRIVE_FOLDER_ID() {
    return getEnv('DRIVE_FOLDER_ID', '1UoMPOvUXmj2Ao9AWSE1f4-eQ7WgrTkZz');
  },
  get LOGO_ID() {
    return getEnv('LOGO_ID', '1UWZKajgW8l1vJX7pTL8kYuF7A6tprIjT');
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

  // Column definitions for PictFinder
  COL: {
    NO: 1,
    LOKASI_RAK: 2,
    GROUP: 3,
    KODE_MATERIAL: 4,
    NAMA_BARANG: 5,
    QTY: 6,
    UOM: 7,
    DESKRIPSI: 8,
    LINK_FOTO: 9
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
    LOGO_ID: '1UWZKajgW8l1vJX7pTL8kYuF7A6tprIjT',
    SHEET_PICTFINDER: 'PictFinder',
    SHEET_USER: 'User',
    SHEET_TCARD: 'Tcard'
  });
  Logger.log('Script Properties initialized successfully!');
}
