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
    .addItem('📥 Salin Data dari Sheet Sumber (64 Item)', 'importFromSourceSheet')
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

/**
 * Imports/copies all material items from external source spreadsheet into PictFinder
 */
function importFromSourceSheet() {
  const ui = SpreadsheetApp.getUi();
  const confirm = ui.alert(
    'Konfirmasi Salin Data',
    'Apakah Anda ingin menyalin seluruh data material dari sheet sumber (64 item)?\n\n' +
    'Sheet Target: "PictFinder"\n' +
    'Sheet Sumber: https://docs.google.com/spreadsheets/d/1SyeWtAjKAFyDs8oDVxKhiQluF45JjB_Se79PjmfrQxQ',
    ui.ButtonSet.OK_CANCEL
  );

  if (confirm !== ui.Button.OK) return;

  try {
    const ss = getSpreadsheetInstance();
    const sheet = ss.getSheetByName(CONFIG.SHEET_PICTFINDER);
    if (!sheet) {
      ui.alert('Error', 'Sheet "' + CONFIG.SHEET_PICTFINDER + '" tidak ditemukan.', ui.ButtonSet.OK);
      return;
    }

    const sourceUrl = 'https://docs.google.com/spreadsheets/d/1SyeWtAjKAFyDs8oDVxKhiQluF45JjB_Se79PjmfrQxQ/export?format=csv&gid=0';
    const resp = UrlFetchApp.fetch(sourceUrl, { muteHttpExceptions: true });
    if (resp.getResponseCode() !== 200) {
      ui.alert('Gagal Mengambil Data', 'Gagal mengakses sheet sumber (HTTP ' + resp.getResponseCode() + ').', ui.ButtonSet.OK);
      return;
    }

    const csvText = resp.getContentText();
    const rows = Utilities.parseCsv(csvText);
    if (!rows || rows.length <= 1) {
      ui.alert('Peringatan', 'Tidak ada baris data yang ditemukan pada sheet sumber.', ui.ButtonSet.OK);
      return;
    }

    const dataRows = rows.slice(1);
    const rowsToInsert = [];

    for (let i = 0; i < dataRows.length; i++) {
      const r = dataRows[i];
      const no = i + 1;
      const lokasi = (r[0] || '').trim();
      const rawKode = (r[1] || '').trim();
      const kode = (rawKode && rawKode !== '-') ? rawKode : ('ITEM-' + (i + 1));
      const nama = (r[2] || '').trim();
      const qty = (r[3] || '').trim();
      const uom = (r[4] || '').trim();
      const deskripsi = (r[5] || '').trim();
      const link1 = (r[6] || '').trim();
      const link2 = (r[7] || '').trim();
      const linkGabungan = (r[8] || '').trim();
      const photo = linkGabungan || link1 || link2;

      rowsToInsert.push([
        no,
        lokasi,
        kode,
        nama,
        qty ? (isNaN(Number(qty)) ? qty : Number(qty)) : '',
        uom,
        deskripsi,
        photo ? '=HYPERLINK("' + photo + '", "Link")' : ''
      ]);
    }

    // Clear old data rows if any
    const lastRow = sheet.getLastRow();
    if (lastRow >= CONFIG.DATA_START_ROW) {
      sheet.getRange(CONFIG.DATA_START_ROW, 1, lastRow - CONFIG.DATA_START_ROW + 1, 8).clearContent();
    }

    // Write all 64 items
    sheet.getRange(CONFIG.DATA_START_ROW, 1, rowsToInsert.length, 8).setValues(rowsToInsert);

    // Standardize formatting and sequential styling
    fixFormat();

    ui.alert(
      'Impor Sukses! 🎉',
      'Berhasil menyalin ' + rowsToInsert.length + ' item material ke sheet "' + CONFIG.SHEET_PICTFINDER + '".',
      ui.ButtonSet.OK
    );
  } catch (err) {
    ui.alert('Gagal Menyalin Data', 'Terjadi kesalahan: ' + err.message, ui.ButtonSet.OK);
  }
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
