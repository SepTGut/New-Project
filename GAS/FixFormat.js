/**
 * Sheet Format Standardization & Repair Utility (FixFormat.js)
 * Standardizes typography, alignments, borders, zebra striping, and column dimensions.
 */

function fixFormat() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(CONFIG.SHEET_PICTFINDER);
  if (!sheet) {
    ss.toast('Sheet ' + CONFIG.SHEET_PICTFINDER + ' tidak ditemukan.', 'Error', 5);
    return;
  }

  const lastRow = Math.max(sheet.getLastRow(), CONFIG.DATA_START_ROW);
  const totalCols = 9;

  // 1. Title Banner (Row 1)
  const titleRange = sheet.getRange(1, 1, 1, totalCols);
  titleRange.setFontFamily('Arial')
    .setFontSize(14)
    .setFontWeight('bold')
    .setFontColor('#1A237E')
    .setVerticalAlignment('middle');

  // 2. Header Row (Row 5)
  const headerRange = sheet.getRange(CONFIG.HEADER_ROW, 1, 1, totalCols);
  headerRange.setBackground('#1A237E')
    .setFontColor('#FFFFFF')
    .setFontFamily('Arial')
    .setFontSize(10)
    .setFontWeight('bold')
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle')
    .setWrap(false);
  sheet.setRowHeight(CONFIG.HEADER_ROW, 32);

  // 3. Data Rows
  if (lastRow >= CONFIG.DATA_START_ROW) {
    const numRows = lastRow - CONFIG.DATA_START_ROW + 1;
    const dataRange = sheet.getRange(CONFIG.DATA_START_ROW, 1, numRows, totalCols);

    // Font and vertical alignment
    dataRange.setFontFamily('Arial')
      .setFontSize(10)
      .setFontColor('#212121')
      .setVerticalAlignment('middle');

    // Thin borders
    dataRange.setBorder(true, true, true, true, true, true, '#D0D5DD', SpreadsheetApp.BorderStyle.SOLID);

    // Zebra striping
    for (let r = 0; r < numRows; r++) {
      const rowIdx = CONFIG.DATA_START_ROW + r;
      const bgColor = (r % 2 === 0) ? '#FFFFFF' : '#F9FAFB';
      sheet.getRange(rowIdx, 1, 1, totalCols).setBackground(bgColor);
      sheet.setRowHeight(rowIdx, 26);
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

  ss.toast('Format sheet ' + CONFIG.SHEET_PICTFINDER + ' berhasil distandarkan!', 'Sukses', 4);
}
