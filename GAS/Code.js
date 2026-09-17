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
 * Opens Print Card modal in Single Item mode using native prompt (KPMscript pattern)
 */
function openSingleCardDialog() {
  PrintCardService.promptAndPrintSingle();
}

/**
 * Opens Print Card modal in Group mode using native prompt (KPMscript pattern)
 */
function openGroupCardDialog() {
  PrintCardService.promptAndPrintGroup();
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
// Client-Side RPC Bridges for HTML Modals
// ==============================================================================

/**
 * Initial dataset payload for PrintCardModal.html
 */
function getPrintModalInitialData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const activeSheet = ss.getActiveSheet();
  let activeRow = -1;
  let activeNo = 1;
  let activeGroup = '';

  if (activeSheet && activeSheet.getName() === CONFIG.SHEET_PICTFINDER) {
    const curRow = activeSheet.getActiveCell().getRow();
    if (curRow >= CONFIG.DATA_START_ROW) {
      activeRow = curRow;
      const noVal = activeSheet.getRange(curRow, CONFIG.COL.NO).getValue();
      if (noVal) activeNo = noVal;
      const grpVal = activeSheet.getRange(curRow, CONFIG.COL.GROUP).getValue();
      if (grpVal) activeGroup = String(grpVal).trim();
    }
  }

  const materials = PrintCardService.getAllMaterialsList();
  const groups = PrintCardService.getAllGroupsData();
  const logoUri = PrintCardService.getLogoDataUri();

  return {
    materials: materials,
    groups: groups,
    logoUri: logoUri,
    activeNo: activeNo,
    activeGroup: activeGroup
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
