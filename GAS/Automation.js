/**
 * Automation & Event Triggers (Automation.js)
 * Handles auto No incrementing, auto Link Foto Drive detection,
 * Hyperlink formatting, and dynamic User account management.
 */

function onEdit(e) {
  if (!e || !e.range) return;
  try {
    const sheet = e.range.getSheet();
    const sheetName = sheet.getName();

    // Route 1: Edits on PictFinder
    if (sheetName === CONFIG.SHEET_PICTFINDER) {
      handlePictFinderEdit(e, sheet);
      return;
    }

    // Route 2: Edits on User sheet (add more or change just one account)
    if (sheetName === CONFIG.SHEET_USER) {
      handleUserEdit(e, sheet);
      return;
    }
  } catch (err) {
    Logger.log('onEdit router error: ' + err.message);
  }
}

/**
 * Handles automated behavior on PictFinder sheet.
 * Fully supports multi-row pastes, drag-downs, and single-cell edits.
 */
function handlePictFinderEdit(e, sheet) {
  try {
    const startRow = e.range.getRow();
    const numRows = e.range.getNumRows();
    const endRow = startRow + numRows - 1;
    const startCol = e.range.getColumn();
    const numCols = e.range.getNumColumns();
    const endCol = startCol + numCols - 1;

    if (endRow < CONFIG.DATA_START_ROW) return;

    const effectiveStart = Math.max(startRow, CONFIG.DATA_START_ROW);

    // 1. Comprehensive auto No gap-healing & sequential assignment
    const maxScanRow = Math.max(sheet.getLastRow(), endRow);
    if (maxScanRow >= CONFIG.DATA_START_ROW) {
      const numScan = maxScanRow - CONFIG.DATA_START_ROW + 1;
      const allVals = sheet.getRange(CONFIG.DATA_START_ROW, 1, numScan, 8).getValues();
      for (let i = 0; i < numScan; i++) {
        const rIdx = CONFIG.DATA_START_ROW + i;
        const rVals = allVals[i];
        const hasContent = rVals.slice(1, 8).some(function(v) {
          return v !== '' && v !== null && v !== undefined && String(v).trim() !== '';
        });
        if (hasContent) {
          const expectedNo = i + 1;
          if (rVals[0] !== expectedNo) {
            sheet.getRange(rIdx, CONFIG.COL.NO).setValue(expectedNo);
          }
        }
      }
    }

    // 2. Auto Hyperlink if Link Foto was pasted or edited
    if (startCol <= CONFIG.COL.LINK_FOTO && endCol >= CONFIG.COL.LINK_FOTO) {
      for (let r = effectiveStart; r <= endRow; r++) {
        const val = String(sheet.getRange(r, CONFIG.COL.LINK_FOTO).getValue() || '').trim();
        if (val && !val.startsWith('=HYPERLINK')) {
          const cleanUrl = formatToDirectDriveUrl(val);
          sheet.getRange(r, CONFIG.COL.LINK_FOTO).setFormula('=HYPERLINK("' + cleanUrl + '", "Link")');
        }
      }
    }

    // 3. Auto Link Foto detection from Drive when Kode Material is entered
    if (startCol <= CONFIG.COL.KODE_MATERIAL && endCol >= CONFIG.COL.KODE_MATERIAL) {
      for (let r = effectiveStart; r <= endRow; r++) {
        const kodeMaterial = String(sheet.getRange(r, CONFIG.COL.KODE_MATERIAL).getValue() || '').trim();
        const fotoCell = sheet.getRange(r, CONFIG.COL.LINK_FOTO);
        if (kodeMaterial && kodeMaterial !== '-' && !fotoCell.getValue()) {
          try {
            const matchedUrl = findDriveImageUrlByCode(kodeMaterial);
            if (matchedUrl) {
              fotoCell.setFormula('=HYPERLINK("' + matchedUrl + '", "Link")');
            }
          } catch (de) {
            Logger.log('Drive lookup notice: ' + de.message);
          }
        }
      }
    }
  } catch (err) {
    Logger.log('handlePictFinderEdit error: ' + err.message);
  }
}

/**
 * Handles dynamic edits on the User sheet
 * Auto-creates No, updates QR Code formula, and hides IIT/IT accounts.
 */
function handleUserEdit(e, sheet) {
  const row = e.range.getRow();
  if (row < 2) return;

  try {
    // 1. Auto No
    const noCell = sheet.getRange(row, 1);
    if (!noCell.getValue()) {
      noCell.setValue(row - 1);
    }

    // 2. Read current row values
    const rowVals = sheet.getRange(row, 1, 1, 7).getValues()[0];
    const username = String(rowVals[2] || '').trim();
    const role = String(rowVals[3] || 'User').trim();
    const pass = String(rowVals[5] || '').trim();

    if (username) {
      // Auto-generate / update QR code formula using JavaScript encodeURIComponent
      const qrPayload = JSON.stringify({ u: username, p: pass, role: role });
      const qrFormula = '=IMAGE("https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=' + encodeURIComponent(qrPayload) + '")';
      sheet.getRange(row, 8).setFormula(qrFormula);
      sheet.setRowHeight(row, 65);

      // 3. Auto-hide IT / IIT account row
      if (role.toLowerCase() === 'iit' || role.toLowerCase() === 'it' || username.toLowerCase().startsWith('iit')) {
        sheet.hideRows(row);
      } else {
        sheet.showRows(row);
      }
    }
  } catch (err) {
    Logger.log('handleUserEdit error: ' + err.message);
  }
}

/**
 * Converts Google Drive share links or raw file IDs into clean direct URLs
 */
function formatToDirectDriveUrl(input) {
  if (!input) return '';
  const str = String(input).trim();

  let fileId = '';
  const match1 = str.match(/\/d\/([a-zA-Z0-9_-]+)/);
  const match2 = str.match(/id=([a-zA-Z0-9_-]+)/);

  if (match1 && match1[1]) {
    fileId = match1[1];
  } else if (match2 && match2[1]) {
    fileId = match2[1];
  } else if (/^[a-zA-Z0-9_-]{20,}$/.test(str)) {
    fileId = str;
  }

  if (fileId) {
    return 'https://drive.google.com/uc?id=' + fileId;
  }
  return str;
}

/**
 * Searches the target Google Drive folder for an image matching the Kode Material
 */
function findDriveImageUrlByCode(kodeMaterial) {
  if (!kodeMaterial || kodeMaterial === '-' || !CONFIG.DRIVE_FOLDER_ID) return null;
  try {
    const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
    const cleanCode = String(kodeMaterial).trim().toLowerCase();
    const files = folder.getFiles();

    while (files.hasNext()) {
      const file = files.next();
      const name = file.getName().toLowerCase();
      const baseName = name.replace(/\.[^/.]+$/, '').trim();
      if (baseName === cleanCode) {
        return 'https://drive.google.com/uc?id=' + file.getId();
      }
    }
  } catch (err) {
    Logger.log('findDriveImageUrlByCode notice: ' + err.message);
  }
  return null;
}

/**
 * Batch utility to synchronize No numbering, heal missing headers, and format all Link Foto cells
 */
function syncNoAndLinks() {
  const ss = getSpreadsheetInstance();
  const sheet = ss.getSheetByName(CONFIG.SHEET_PICTFINDER);
  if (!sheet) {
    try { ss.toast('Sheet ' + CONFIG.SHEET_PICTFINDER + ' tidak ditemukan.', 'Error', 5); } catch (e) {}
    return;
  }

  // 1. Enforce & restore full header row
  const headers = ['No', 'Lokasi Rak', 'Kode Material', 'Nama Barang', 'Qty', 'UoM', 'Deskripsi', 'Link Foto'];
  sheet.getRange(CONFIG.HEADER_ROW, 1, 1, 8).setValues([headers]);

  const lastRow = sheet.getLastRow();
  if (lastRow < CONFIG.DATA_START_ROW) {
    try { ss.toast('Tidak ada baris data untuk disinkronisasi.', 'Info', 3); } catch (e) {}
    return;
  }

  const numRows = lastRow - CONFIG.DATA_START_ROW + 1;
  const rangeData = sheet.getRange(CONFIG.DATA_START_ROW, 1, numRows, 8).getValues();
  const formulas = sheet.getRange(CONFIG.DATA_START_ROW, CONFIG.COL.LINK_FOTO, numRows, 1).getFormulas();

  let updatedNoCount = 0;
  let updatedLinkCount = 0;

  for (let i = 0; i < numRows; i++) {
    const rowIdx = CONFIG.DATA_START_ROW + i;
    const rowVals = rangeData[i];

    const hasContent = rowVals.slice(1, 8).some(function(v) {
      return v !== '' && v !== null && v !== undefined && String(v).trim() !== '';
    });

    if (hasContent) {
      const expectedNo = i + 1;
      if (rowVals[0] !== expectedNo) {
        sheet.getRange(rowIdx, CONFIG.COL.NO).setValue(expectedNo);
        updatedNoCount++;
      }

      const currentFormula = formulas[i][0];
      const currentVal = rowVals[CONFIG.COL.LINK_FOTO - 1];
      const kodeMaterial = rowVals[CONFIG.COL.KODE_MATERIAL - 1];

      if (currentFormula && currentFormula.startsWith('=HYPERLINK')) {
        // Already formatted hyperlink
      } else if (currentVal && String(currentVal).trim() && String(currentVal).trim() !== '-') {
        const cleanUrl = formatToDirectDriveUrl(currentVal);
        sheet.getRange(rowIdx, CONFIG.COL.LINK_FOTO).setFormula('=HYPERLINK("' + cleanUrl + '", "Link")');
        updatedLinkCount++;
      } else if (kodeMaterial && String(kodeMaterial).trim() !== '-') {
        try {
          const matched = findDriveImageUrlByCode(kodeMaterial);
          if (matched) {
            sheet.getRange(rowIdx, CONFIG.COL.LINK_FOTO).setFormula('=HYPERLINK("' + matched + '", "Link")');
            updatedLinkCount++;
          }
        } catch (de) {}
      }
    }
  }

  try {
    ss.toast('Sinkronisasi selesai! No: ' + updatedNoCount + ' baris diperbarui, Link: ' + updatedLinkCount + ' formula diperbarui.', 'Sukses', 5);
  } catch (e) {}
}
