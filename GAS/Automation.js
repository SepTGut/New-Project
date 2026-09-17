/**
 * Automation & Event Triggers (Automation.js)
 * Handles auto No incrementing, auto Link Foto Drive detection, and Hyperlink formatting.
 */

/**
 * Standard onEdit trigger responding to user edits in real-time
 */
function onEdit(e) {
  if (!e || !e.range) return;
  const sheet = e.range.getSheet();
  if (sheet.getName() !== CONFIG.SHEET_PICTFINDER) return;

  const row = e.range.getRow();
  const col = e.range.getColumn();

  if (row < CONFIG.DATA_START_ROW) return;

  try {
    // 1. Auto No: If editing row and No is blank, auto-assign sequential number
    const noCell = sheet.getRange(row, CONFIG.COL.NO);
    if (!noCell.getValue()) {
      const hasContent = sheet.getRange(row, 2, 1, 7).getValues()[0].some(function(v) {
        return v !== '' && v !== null && v !== undefined;
      });
      if (hasContent) {
        const autoNo = row - CONFIG.HEADER_ROW;
        noCell.setValue(autoNo);
      }
    }

    // 2. Auto Hyperlink if Link Foto was pasted
    if (col === CONFIG.COL.LINK_FOTO) {
      const val = String(e.value || sheet.getRange(row, col).getValue() || '').trim();
      if (val && !val.startsWith('=HYPERLINK')) {
        const cleanUrl = formatToDirectDriveUrl(val);
        sheet.getRange(row, col).setFormula('=HYPERLINK("' + cleanUrl + '", "Link")');
      }
    }

    // 3. Auto Link Foto detection from Drive when Kode Material is entered
    if (col === CONFIG.COL.KODE_MATERIAL) {
      const kodeMaterial = String(e.value || sheet.getRange(row, col).getValue() || '').trim();
      const fotoCell = sheet.getRange(row, CONFIG.COL.LINK_FOTO);
      if (kodeMaterial && !fotoCell.getValue()) {
        const matchedUrl = findDriveImageUrlByCode(kodeMaterial);
        if (matchedUrl) {
          fotoCell.setFormula('=HYPERLINK("' + matchedUrl + '", "Link")');
        }
      }
    }
  } catch (err) {
    Logger.log('onEdit automation error: ' + err.message);
  }
}

/**
 * Converts Google Drive share links or raw file IDs into clean direct URLs
 */
function formatToDirectDriveUrl(input) {
  if (!input) return '';
  const str = String(input).trim();

  // If input is already an ID (alphanumeric with - and _)
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
  if (!kodeMaterial || !CONFIG.DRIVE_FOLDER_ID) return null;
  try {
    const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
    const cleanCode = String(kodeMaterial).trim().toLowerCase();
    const files = folder.getFiles();

    while (files.hasNext()) {
      const file = files.next();
      const name = file.getName().toLowerCase();
      // Match base name without extension
      const baseName = name.replace(/\.[^/.]+$/, '').trim();
      if (baseName === cleanCode) {
        return 'https://drive.google.com/uc?id=' + file.getId();
      }
    }
  } catch (err) {
    Logger.log('findDriveImageUrlByCode warning: ' + err.message);
  }
  return null;
}

/**
 * Batch utility to synchronize No numbering and format all Link Foto cells
 */
function syncNoAndLinks() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_PICTFINDER);
  if (!sheet) {
    ss.toast('Sheet ' + CONFIG.SHEET_PICTFINDER + ' tidak ditemukan.', 'Error', 5);
    return;
  }

  const lastRow = sheet.getLastRow();
  if (lastRow < CONFIG.DATA_START_ROW) {
    ss.toast('Tidak ada baris data untuk disinkronisasi.', 'Info', 3);
    return;
  }

  const numRows = lastRow - CONFIG.DATA_START_ROW + 1;
  const rangeData = sheet.getRange(CONFIG.DATA_START_ROW, 1, numRows, 9).getValues();
  const formulas = sheet.getRange(CONFIG.DATA_START_ROW, 9, numRows, 1).getFormulas();

  let updatedNoCount = 0;
  let updatedLinkCount = 0;

  for (let i = 0; i < numRows; i++) {
    const rowIdx = CONFIG.DATA_START_ROW + i;
    const rowVals = rangeData[i];

    // Check if row has any content
    const hasContent = rowVals.slice(1, 8).some(function(v) {
      return v !== '' && v !== null && v !== undefined;
    });

    if (hasContent) {
      // 1. Sync No
      const expectedNo = i + 1;
      if (rowVals[0] !== expectedNo) {
        sheet.getRange(rowIdx, CONFIG.COL.NO).setValue(expectedNo);
        updatedNoCount++;
      }

      // 2. Sync Link Foto
      const currentFormula = formulas[i][0];
      const currentVal = rowVals[8];
      const kodeMaterial = rowVals[3];

      if (currentFormula && currentFormula.startsWith('=HYPERLINK')) {
        // Already formatted hyperlink
      } else if (currentVal && String(currentVal).trim()) {
        const cleanUrl = formatToDirectDriveUrl(currentVal);
        sheet.getRange(rowIdx, CONFIG.COL.LINK_FOTO).setFormula('=HYPERLINK("' + cleanUrl + '", "Link")');
        updatedLinkCount++;
      } else if (kodeMaterial) {
        // Try searching Drive
        const matched = findDriveImageUrlByCode(kodeMaterial);
        if (matched) {
          sheet.getRange(rowIdx, CONFIG.COL.LINK_FOTO).setFormula('=HYPERLINK("' + matched + '", "Link")');
          updatedLinkCount++;
        }
      }
    }
  }

  ss.toast('Sinkronisasi selesai! No: ' + updatedNoCount + ' baris diperbarui, Link: ' + updatedLinkCount + ' formula diperbarui.', 'Sukses', 5);
}
