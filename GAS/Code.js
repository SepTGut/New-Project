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
        photo ? '=HYPERLINK("' + photo + '"; "Link")' : ''
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
// Web App REST Endpoints (doGet / doPost) for Remote Diagnostics, Bot & Sync
// ==============================================================================

function doGet(e) {
  return handleApiRequest(e);
}

function doPost(e) {
  return handleApiRequest(e);
}

function handleApiRequest(e) {
  try {
    let body = {};
    if (e && e.postData && e.postData.contents) {
      try {
        body = JSON.parse(e.postData.contents);
      } catch (err) {
        // Not JSON or plain form, ignore
      }
    }
    const params = Object.assign({}, (e && e.parameter) || {}, body);
    const action = (params.action || 'sync').toString().toLowerCase();

    if (action === 'ping') {
      return jsonResponse({
        success: true,
        status: 'online',
        spreadsheetId: CONFIG.SPREADSHEET_ID,
        timestamp: new Date().toISOString()
      });
    }

    if (action === 'login') {
      const result = UserService.verifyUser(params.username, params.password);
      return jsonResponse(result);
    }

    if (action === 'search') {
      const q = String(params.q || params.query || '').trim().toLowerCase();
      const ss = getSpreadsheetInstance();
      const sheet = ss.getSheetByName(CONFIG.SHEET_PICTFINDER);
      if (!sheet) {
        return jsonResponse({ success: false, error: 'Sheet PictFinder tidak ditemukan.' });
      }
      const lastRow = sheet.getLastRow();
      if (lastRow < CONFIG.DATA_START_ROW) {
        return jsonResponse({ success: true, count: 0, items: [] });
      }

      const numRows = lastRow - CONFIG.DATA_START_ROW + 1;
      const values = sheet.getRange(CONFIG.DATA_START_ROW, 1, numRows, 8).getValues();
      const formulas = sheet.getRange(CONFIG.DATA_START_ROW, CONFIG.COL.LINK_FOTO, numRows, 1).getFormulas();
      const items = [];

      for (let i = 0; i < values.length; i++) {
        const row = values[i];
        const kode = String(row[CONFIG.COL.KODE_MATERIAL - 1] || '').trim();
        const nama = String(row[CONFIG.COL.NAMA_BARANG - 1] || '').trim();
        const rak = String(row[CONFIG.COL.LOKASI_RAK - 1] || '').trim();
        const qty = row[CONFIG.COL.QTY - 1];
        const uom = String(row[CONFIG.COL.UOM - 1] || '').trim();
        const deskripsi = String(row[CONFIG.COL.DESKRIPSI - 1] || '').trim();
        const rawLink = String(row[CONFIG.COL.LINK_FOTO - 1] || formulas[i][0] || '').trim();

        const hasContent = row.slice(1, 7).some(function(v) {
          return v !== '' && v !== null && v !== undefined && String(v).trim() !== '';
        });
        if (!hasContent && !kode) continue;

        let isMatch = !q;
        if (q) {
          const noStr = String(row[CONFIG.COL.NO - 1] || (i + 1));
          const rowText = (noStr + ' #' + noStr + ' ' + kode + ' ' + nama + ' ' + rak + ' ' + deskripsi + ' ' + uom).toLowerCase();
          const strippedRow = rowText.replace(/[^a-z0-9]/g, '');
          const qTokens = q.split(/[\s,;|/]+/).filter(function(t) { return t.length > 0; });

          isMatch = qTokens.every(function(t) {
            if (rowText.indexOf(t) !== -1) return true;
            const strippedT = t.replace(/[^a-z0-9]/g, '');
            return strippedT && strippedRow.indexOf(strippedT) !== -1;
          });
        }

        if (isMatch) {
          const fileId = extractDriveFileId(rawLink);
          items.push({
            no: row[CONFIG.COL.NO - 1] || (i + 1),
            rowIndex: CONFIG.DATA_START_ROW + i,
            lokasiRak: rak || '-',
            kodeMaterial: kode,
            namaBarang: nama,
            qty: (qty !== '' && qty !== null && !isNaN(qty)) ? Number(qty) : 0,
            uom: uom || 'PCS',
            deskripsi: deskripsi || '-',
            linkFoto: rawLink,
            fileId: fileId,
            imageUrl: fileId ? ('https://lh3.googleusercontent.com/d/' + fileId) : ''
          });
          if (items.length >= 50) break; // Limit to 50 for speed
        }
      }

      return jsonResponse({
        success: true,
        count: items.length,
        query: q,
        items: items
      });
    }

    if (action === 'check' || action === 'getitem') {
      const code = String(params.kode || params.code || '').trim().toLowerCase();
      if (!code) {
        return jsonResponse({ success: false, error: 'Kode material diperlukan.' });
      }
      const ss = getSpreadsheetInstance();
      const sheet = ss.getSheetByName(CONFIG.SHEET_PICTFINDER);
      const lastRow = sheet.getLastRow();
      if (lastRow < CONFIG.DATA_START_ROW) {
        return jsonResponse({ success: false, error: 'Data material kosong.' });
      }

      const numRows = lastRow - CONFIG.DATA_START_ROW + 1;
      const values = sheet.getRange(CONFIG.DATA_START_ROW, 1, numRows, 8).getValues();
      const formulas = sheet.getRange(CONFIG.DATA_START_ROW, CONFIG.COL.LINK_FOTO, numRows, 1).getFormulas();

      for (let i = 0; i < values.length; i++) {
        const row = values[i];
        const kode = String(row[CONFIG.COL.KODE_MATERIAL - 1] || '').trim();
        if (kode.toLowerCase() === code) {
          const rawLink = String(row[CONFIG.COL.LINK_FOTO - 1] || formulas[i][0] || '').trim();
          const fileId = extractDriveFileId(rawLink);
          return jsonResponse({
            success: true,
            found: true,
            item: {
              no: row[CONFIG.COL.NO - 1] || (i + 1),
              rowIndex: CONFIG.DATA_START_ROW + i,
              lokasiRak: String(row[CONFIG.COL.LOKASI_RAK - 1] || '-').trim(),
              kodeMaterial: kode,
              namaBarang: String(row[CONFIG.COL.NAMA_BARANG - 1] || '-').trim(),
              qty: Number(row[CONFIG.COL.QTY - 1]) || 0,
              uom: String(row[CONFIG.COL.UOM - 1] || 'PCS').trim(),
              deskripsi: String(row[CONFIG.COL.DESKRIPSI - 1] || '-').trim(),
              linkFoto: rawLink,
              fileId: fileId,
              imageUrl: fileId ? ('https://lh3.googleusercontent.com/d/' + fileId) : ''
            }
          });
        }
      }
      return jsonResponse({ success: false, found: false, error: 'Material "' + code + '" tidak ditemukan.' });
    }

    if (action === 'opname') {
      const code = String(params.kode || params.code || '').trim().toLowerCase();
      const newQty = Number(params.qty);
      const user = String(params.user || params.username || 'WhatsApp User').trim();

      if (!code) {
        return jsonResponse({ success: false, error: 'Kode material diperlukan.' });
      }
      if (isNaN(newQty) || newQty < 0) {
        return jsonResponse({ success: false, error: 'Qty fisik harus berupa angka positif.' });
      }

      const ss = getSpreadsheetInstance();
      const sheet = ss.getSheetByName(CONFIG.SHEET_PICTFINDER);
      const lastRow = sheet.getLastRow();
      if (lastRow < CONFIG.DATA_START_ROW) {
        return jsonResponse({ success: false, error: 'Data material kosong.' });
      }

      const numRows = lastRow - CONFIG.DATA_START_ROW + 1;
      const values = sheet.getRange(CONFIG.DATA_START_ROW, CONFIG.COL.KODE_MATERIAL, numRows, 1).getValues();

      for (let i = 0; i < values.length; i++) {
        const k = String(values[i][0] || '').trim();
        if (k.toLowerCase() === code) {
          const targetRow = CONFIG.DATA_START_ROW + i;
          const oldQty = sheet.getRange(targetRow, CONFIG.COL.QTY).getValue();
          sheet.getRange(targetRow, CONFIG.COL.QTY).setValue(newQty);

          const nama = sheet.getRange(targetRow, CONFIG.COL.NAMA_BARANG).getValue();
          const rak = sheet.getRange(targetRow, CONFIG.COL.LOKASI_RAK).getValue();
          const uom = sheet.getRange(targetRow, CONFIG.COL.UOM).getValue();

          return jsonResponse({
            success: true,
            kodeMaterial: k,
            namaBarang: nama,
            lokasiRak: rak,
            oldQty: oldQty,
            newQty: newQty,
            uom: uom,
            updatedBy: user,
            timestamp: new Date().toISOString()
          });
        }
      }
      return jsonResponse({ success: false, error: 'Kode material "' + code + '" tidak ditemukan di database.' });
    }

    if (action === 'add') {
      const rak = String(params.rak || '').trim();
      const kode = String(params.kode || '').trim();
      const nama = String(params.nama || '').trim();
      const qty = isNaN(Number(params.qty)) ? 0 : Number(params.qty);
      const uom = String(params.uom || 'PCS').trim().toUpperCase();
      const deskripsi = String(params.deskripsi || params.desk || '-').trim();
      const user = String(params.user || params.username || 'Admin').trim();

      if (!kode || !nama) {
        return jsonResponse({ success: false, error: 'Kode material dan nama barang wajib diisi.' });
      }

      const ss = getSpreadsheetInstance();
      const sheet = ss.getSheetByName(CONFIG.SHEET_PICTFINDER);
      const lastRow = sheet.getLastRow();

      // Check if code already exists
      if (lastRow >= CONFIG.DATA_START_ROW) {
        const existingCodes = sheet.getRange(CONFIG.DATA_START_ROW, CONFIG.COL.KODE_MATERIAL, lastRow - CONFIG.DATA_START_ROW + 1, 1).getValues();
        for (let i = 0; i < existingCodes.length; i++) {
          if (String(existingCodes[i][0] || '').trim().toLowerCase() === kode.toLowerCase()) {
            return jsonResponse({
              success: false,
              error: 'Kode material "' + kode + '" sudah ada. Gunakan !opname untuk mengubah stok.'
            });
          }
        }
      }

      const targetRow = Math.max(lastRow + 1, CONFIG.DATA_START_ROW);
      const nextNo = targetRow - CONFIG.DATA_START_ROW + 1;

      // Auto check drive for image
      let linkFormula = '';
      let fileId = '';
      const driveImgUrl = findDriveImageUrlByCode(kode);
      if (driveImgUrl) {
        linkFormula = '=HYPERLINK("' + driveImgUrl + '"; "Lihat Foto")';
        fileId = extractDriveFileId(driveImgUrl);
      }

      sheet.getRange(targetRow, 1, 1, 8).setValues([[
        nextNo,
        rak || '-',
        kode,
        nama,
        qty,
        uom,
        deskripsi,
        linkFormula || '-'
      ]]);

      fixFormat();

      return jsonResponse({
        success: true,
        item: {
          no: nextNo,
          lokasiRak: rak || '-',
          kodeMaterial: kode,
          namaBarang: nama,
          qty: qty,
          uom: uom,
          deskripsi: deskripsi,
          linkFoto: driveImgUrl || '',
          fileId: fileId,
          imageUrl: fileId ? ('https://lh3.googleusercontent.com/d/' + fileId) : ''
        },
        createdBy: user,
        timestamp: new Date().toISOString()
      });
    }

    // Default action: Run full system sync, repair headers, numbering, and user formulas
    fixFormat();
    syncNoAndLinks();
    UserService.setupUsersSheet();

    return jsonResponse({
      success: true,
      message: 'Sistem dan sheet berhasil diperbaiki serta disinkronisasi!',
      spreadsheetId: CONFIG.SPREADSHEET_ID,
      timestamp: new Date().toISOString()
    });

  } catch (err) {
    return jsonResponse({
      success: false,
      error: err.message,
      timestamp: new Date().toISOString()
    });
  }
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function extractDriveFileId(str) {
  if (!str) return '';
  const s = String(str);
  const m1 = s.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (m1 && m1[1]) return m1[1];
  const m2 = s.match(/id=([a-zA-Z0-9_-]+)/);
  if (m2 && m2[1]) return m2[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(s)) return s;
  return '';
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
