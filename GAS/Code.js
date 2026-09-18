/**
 * Warehouse System Master Controller (Code.js)
 * Builds custom menus, dialog windows, client RPC bridges, and Web App endpoints.
 */

function onOpen() {
  const ui = SpreadsheetApp.getUi();

  ui.createMenu('📦 Smart Warehouse')
    .addItem('🏷️ Cetak Kartu Material (4/A4)', 'openSingleCardDialog')
    .addItem('🪪 Cetak QR Login Pengguna (User QR)', 'openUserQRDialog')
    .addSeparator()
    .addItem('🧹 Rapikan Format Sheet (Fix Format)', 'fixFormat')
    .addItem('🔄 Sinkronisasi No & Link Foto', 'syncNoAndLinks')
    .addItem('⚙️ Inisialisasi Sheet Pengguna (User)', 'setupUsersSheetWrapper')
    .addToUi();
}

/**
 * Opens Print Card modal in Single Item mode using native prompt (KPMscript pattern)
 */
function openSingleCardDialog() {
  PrintCardService.promptAndPrintSingle();
}

/**
 * Opens User Login QR Badge printing modal
 */
function openUserQRDialog() {
  const template = HtmlService.createTemplateFromFile('PrintUserQR');
  template.logoUri = PrintCardService.getLogoDataUri();
  const html = template.evaluate()
    .setWidth(920)
    .setHeight(680)
    .setTitle('Cetak Kartu QR Login Pengguna');
  SpreadsheetApp.getUi().showModalDialog(html, 'Kartu QR Login Pengguna');
}

/**
 * Wrapper to initialize User sheet from menu
 */
function setupUsersSheetWrapper() {
  UserService.setupUsersSheet();
}

// ==============================================================================
// Web App REST Endpoints (doGet / doPost) for Remote Diagnostics & Sync
// ==============================================================================

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) ? String(e.parameter.action).toLowerCase() : 'sync';

    if (action === 'ping') {
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        status: 'online',
        spreadsheetId: CONFIG.SPREADSHEET_ID,
        timestamp: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Default action: Run full system sync, repair headers, numbering, and user formulas
    fixFormat();
    syncNoAndLinks();
    UserService.setupUsersSheet();

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: 'Sistem dan sheet berhasil diperbaiki serta disinkronisasi!',
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.message,
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  return doGet(e);
}

// ==============================================================================
// Client-Side RPC Bridges for HTML Modals
// ==============================================================================

/**
 * Initial dataset payload for PrintCardModal.html
 */
function getPrintModalInitialData() {
  const ss = getSpreadsheetInstance();
  const activeSheet = ss.getActiveSheet();
  let activeRow = -1;
  let activeNo = 1;

  if (activeSheet && activeSheet.getName() === CONFIG.SHEET_PICTFINDER) {
    const curRow = activeSheet.getActiveCell().getRow();
    if (curRow >= CONFIG.DATA_START_ROW) {
      activeRow = curRow;
      const noVal = activeSheet.getRange(curRow, CONFIG.COL.NO).getValue();
      if (noVal) activeNo = noVal;
    }
  }

  const materials = PrintCardService.getAllMaterialsList();
  const logoUri = PrintCardService.getLogoDataUri();

  return {
    materials: materials,
    logoUri: logoUri,
    activeNo: activeNo
  };
}

function getItemCardData(codeOrRow) {
  return PrintCardService.getItemCardData(codeOrRow);
}

function getUserQRModalData() {
  return {
    users: UserService.getAllUsersForPrint(),
    logoUri: PrintCardService.getLogoDataUri()
  };
}
