/**
 * Sheet Format Standardization & Repair Utility (FixFormat.js)
 * Standardizes typography, alignments, borders, zebra striping, and column dimensions.
 * Explicitly enforces and restores missing header titles and fills numbering gaps.
 */

function getSpreadsheetInstance() {
  try {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
  } catch (e) {}
  if (CONFIG && CONFIG.SPREADSHEET_ID) {
    return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

function fixFormat() {
  const ss = getSpreadsheetInstance();
  const sheet = ss.getSheetByName(CONFIG.SHEET_PICTFINDER);
  if (!sheet) {
    try { ss.toast('Sheet ' + CONFIG.SHEET_PICTFINDER + ' tidak ditemukan.', 'Error', 5); } catch (e) {}
    return;
  }

  const lastRow = Math.max(sheet.getLastRow(), CONFIG.DATA_START_ROW);
  const totalCols = 9;

  // 1. Title Banner (Row 1 to 3)
  try {
    const titleCell = sheet.getRange(1, 1);
    if (!titleCell.getValue()) {
      titleCell.setValue('Stock Opname Gudang');
    }
    const titleRange = sheet.getRange(1, 1, 3, totalCols);
    titleRange.setFontFamily('Arial')
      .setFontSize(14)
      .setFontWeight('bold')
      .setFontColor('#1A237E')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
  } catch (err) {
    Logger.log('Title banner format notice: ' + err.message);
  }

  // 2. Header Row (Row 5) - Enforce and restore all column names
  const headers = ['No', 'Lokasi Rak', 'Group', 'Kode Material', 'Nama Barang', 'Qty', 'UoM', 'Deskripsi', 'Link Foto'];
  const headerRange = sheet.getRange(CONFIG.HEADER_ROW, 1, 1, totalCols);
  headerRange.setValues([headers]);
  headerRange.setBackground('#1A237E')
    .setFontColor('#FFFFFF')
    .setFontFamily('Arial')
    .setFontSize(10)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setWrap(false);
  sheet.setRowHeight(CONFIG.HEADER_ROW, 32);

  // 3. Data Rows & Auto-Repair Numbering Gaps
  if (lastRow >= CONFIG.DATA_START_ROW) {
    const numRows = lastRow - CONFIG.DATA_START_ROW + 1;
    const dataRange = sheet.getRange(CONFIG.DATA_START_ROW, 1, numRows, totalCols);
    const dataValues = dataRange.getValues();

    // Standard Font and vertical alignment
    dataRange.setFontFamily('Arial')
      .setFontSize(10)
      .setFontColor('#212121')
      .setVerticalAlignment('middle');

    // Thin borders
    dataRange.setBorder(true, true, true, true, true, true, '#D0D5DD', SpreadsheetApp.BorderStyle.SOLID);

    // Sequential numbering and zebra striping
    for (let r = 0; r < numRows; r++) {
      const rowIdx = CONFIG.DATA_START_ROW + r;
      const rowVals = dataValues[r];
      const bgColor = (r % 2 === 0) ? '#FFFFFF' : '#F9FAFB';

      sheet.getRange(rowIdx, 1, 1, totalCols).setBackground(bgColor);
      sheet.setRowHeight(rowIdx, 26);

      // Check if row has any content in columns 2 to 9
      const hasContent = rowVals.slice(1, 9).some(function(v) {
        return v !== '' && v !== null && v !== undefined && String(v).trim() !== '';
      });

      if (hasContent) {
        const expectedNo = r + 1;
        const currentNo = rowVals[0];
        if (currentNo !== expectedNo) {
          sheet.getRange(rowIdx, CONFIG.COL.NO).setValue(expectedNo);
        }
      }
    }

    // Column specific alignments
    sheet.getRange(CONFIG.DATA_START_ROW, CONFIG.COL.NO, numRows, 1).setHorizontalAlignment('center');
    sheet.getRange(CONFIG.DATA_START_ROW, CONFIG.COL.LOKASI_RAK, numRows, 1).setHorizontalAlignment('center');
    sheet.getRange(CONFIG.DATA_START_ROW, CONFIG.COL.GROUP, numRows, 1).setHorizontalAlignment('center');
    sheet.getRange(CONFIG.DATA_START_ROW, CONFIG.COL.KODE_MATERIAL, numRows, 1).setHorizontalAlignment('center').setFontWeight('bold');
    sheet.getRange(CONFIG.DATA_START_ROW, CONFIG.COL.NAMA_BARANG, numRows, 1).setHorizontalAlignment('left');
    sheet.getRange(CONFIG.DATA_START_ROW, CONFIG.COL.QTY, numRows, 1).setHorizontalAlignment('right').setNumberFormat('#,##0');
    sheet.getRange(CONFIG.DATA_START_ROW, CONFIG.COL.UOM, numRows, 1).setHorizontalAlignment('center');
    sheet.getRange(CONFIG.DATA_START_ROW, CONFIG.COL.DESKRIPSI, numRows, 1).setHorizontalAlignment('left').setWrap(true);
    sheet.getRange(CONFIG.DATA_START_ROW, CONFIG.COL.LINK_FOTO, numRows, 1).setHorizontalAlignment('center');
  }

  // 4. Standard Column Widths
  sheet.setColumnWidth(CONFIG.COL.NO, 50);
  sheet.setColumnWidth(CONFIG.COL.LOKASI_RAK, 110);
  sheet.setColumnWidth(CONFIG.COL.GROUP, 110);
  sheet.setColumnWidth(CONFIG.COL.KODE_MATERIAL, 140);
  sheet.setColumnWidth(CONFIG.COL.NAMA_BARANG, 260);
  sheet.setColumnWidth(CONFIG.COL.QTY, 70);
  sheet.setColumnWidth(CONFIG.COL.UOM, 75);
  sheet.setColumnWidth(CONFIG.COL.DESKRIPSI, 240);
  sheet.setColumnWidth(CONFIG.COL.LINK_FOTO, 95);

  // 5. Also standardize User sheet headers and formatting
  try {
    if (typeof UserService !== 'undefined' && UserService.setupUsersSheet) {
      UserService.setupUsersSheet();
    }
  } catch (ue) {
    Logger.log('fixFormat User sheet notice: ' + ue.message);
  }

  try {
    ss.toast('Format sheet ' + CONFIG.SHEET_PICTFINDER + ' dan User berhasil distandarkan!', 'Sukses', 4);
  } catch (e) {}
}
