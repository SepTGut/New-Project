/**
 * Warehouse System Master Controller (Code.js)
 * Builds custom menus, dialog windows, and client RPC bridges.
 */

function onOpen() {
  const ui = SpreadsheetApp.getUi();

  ui.createMenu('📦 Smart Warehouse')
    .addItem('🏷️ Cetak Kartu Material (Single - 4/A4)', 'openSingleCardDialog')
    .addItem('📦 Cetak Kartu Group (Group - 2/A4)', 'openGroupCardDialog')
    .addItem('🪪 Cetak QR Login Pengguna (User QR)', 'openUserQRDialog')
    .addSeparator()
    .addItem('🧹 Rapikan Format Sheet (Fix Format)', 'fixFormat')
    .addItem('🔄 Sinkronisasi No & Link Foto', 'syncNoAndLinks')
    .addItem('⚙️ Inisialisasi Sheet Pengguna (User)', 'setupUsersSheetWrapper')
    .addToUi();
}

/**
 * Opens Print Card modal in Single Item mode
 */
function openSingleCardDialog() {
  const html = HtmlService.createHtmlOutputFromFile('PrintCardModal')
    .setWidth(980)
    .setHeight(720)
    .setTitle('Cetak Kartu Stok Material (Single - 4/A4)');
  SpreadsheetApp.getUi().showModalDialog(html, 'Cetak Kartu Stok Material');
}

/**
 * Opens Print Card modal in Group mode
 */
function openGroupCardDialog() {
  const html = HtmlService.createHtmlOutputFromFile('PrintCardModal')
    .setWidth(980)
    .setHeight(720)
    .setTitle('Cetak Kartu Stok Material (Group - 2/A4)');
  SpreadsheetApp.getUi().showModalDialog(html, 'Cetak Kartu Stok Material');
}

/**
 * Opens User Login QR Badge printing modal
 */
function openUserQRDialog() {
  const html = HtmlService.createHtmlOutputFromFile('PrintUserQR')
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
// Client-Side RPC Bridges for HTML Modals
// ==============================================================================

/**
 * Initial dataset payload for PrintCardModal.html
 */
function getPrintModalInitialData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const activeSheet = ss.getActiveSheet();
  let activeRow = -1;

  if (activeSheet && activeSheet.getName() === CONFIG.SHEET_PICTFINDER) {
    const curRow = activeSheet.getActiveCell().getRow();
    if (curRow >= CONFIG.DATA_START_ROW) {
      activeRow = curRow;
    }
  }

  const materials = PrintCardService.getAllMaterialsList();
  const groups = PrintCardService.getAllGroupsList();
  const logoUri = PrintCardService.getLogoDataUri();

  let defaultItem = null;
  if (activeRow !== -1) {
    defaultItem = PrintCardService.getItemCardData(activeRow);
  } else if (materials.length > 0) {
    defaultItem = PrintCardService.getItemCardData(materials[0].kodeMaterial);
  }

  return {
    materials: materials,
    groups: groups,
    logoUri: logoUri,
    defaultItem: defaultItem
  };
}

function getItemCardData(codeOrRow) {
  return PrintCardService.getItemCardData(codeOrRow);
}

function getGroupCardData(groupName) {
  return PrintCardService.getGroupCardData(groupName);
}

function getUserQRModalData() {
  return {
    users: UserService.getAllUsersForPrint(),
    logoUri: PrintCardService.getLogoDataUri()
  };
}
