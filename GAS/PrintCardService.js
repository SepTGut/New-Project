/**
 * Stock Card Data Engine (PrintCardService.js)
 * Prepares single item and group card datasets following the Tcard specifications.
 */

const PrintCardService = {
  /**
   * Retrieves the target logo (Drive ID: 1UWZKajgW8l1vJX7pTL8kYuF7A6tprIjT)
   * 1. Priority 1: High-res embedded Base64 data URI from LogoUri.js (instant, offline, zero latency)
   * 2. Priority 2: Direct DriveApp extraction
   * 3. Priority 3: Direct Google Drive UC URL
   */
  getLogoDataUri: function() {
    // 1. Instant high-res embedded Base64 URI for 1UWZKajgW8l1vJX7pTL8kYuF7A6tprIjT
    try {
      if (typeof getTargetLogoDataUri === 'function') {
        const uri = getTargetLogoDataUri();
        if (uri) return uri;
      }
      if (typeof TARGET_LOGO_DATA_URI !== 'undefined' && TARGET_LOGO_DATA_URI) {
        return TARGET_LOGO_DATA_URI;
      }
    } catch (e) {
      Logger.log('getLogoDataUri notice: ' + e.message);
    }

    // 2. DriveApp extraction
    const logoId = CONFIG.LOGO_ID || '1UWZKajgW8l1vJX7pTL8kYuF7A6tprIjT';
    try {
      const file = DriveApp.getFileById(logoId);
      const blob = file.getBlob();
      const contentType = blob.getContentType();
      const base64 = Utilities.base64Encode(blob.getBytes());
      return 'data:' + contentType + ';base64,' + base64;
    } catch (err) {
      Logger.log('getLogoDataUri DriveApp warning: ' + err.message);
    }

    // 3. Fallback direct Drive view URL
    return 'https://drive.google.com/uc?id=' + logoId;
  },

  /**
   * Returns list of all materials for UI dropdown selection
   */
  getAllMaterialsList: function() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_PICTFINDER);
    if (!sheet) return [];

    const lastRow = sheet.getLastRow();
    if (lastRow < CONFIG.DATA_START_ROW) return [];

    const numRows = lastRow - CONFIG.DATA_START_ROW + 1;
    const values = sheet.getRange(CONFIG.DATA_START_ROW, 1, numRows, 9).getValues();
    const list = [];

    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      const kode = String(row[CONFIG.COL.KODE_MATERIAL - 1] || '').trim();
      const nama = String(row[CONFIG.COL.NAMA_BARANG - 1] || '').trim();
      const group = String(row[CONFIG.COL.GROUP - 1] || '').trim();
      const lokasi = String(row[CONFIG.COL.LOKASI_RAK - 1] || '').trim();

      if (kode || nama) {
        list.push({
          rowIndex: CONFIG.DATA_START_ROW + i,
          kodeMaterial: kode || ('ITEM-' + (i + 1)),
          namaBarang: nama,
          group: group,
          lokasiRak: lokasi
        });
      }
    }

    return list;
  },

  /**
   * Returns list of all distinct Groups for UI dropdown selection
   */
  getAllGroupsList: function() {
    const materials = this.getAllMaterialsList();
    const groupsSet = {};

    materials.forEach(function(m) {
      const g = (m.group || '').trim();
      if (g) {
        groupsSet[g] = (groupsSet[g] || 0) + 1;
      }
    });

    const groups = Object.keys(groupsSet).sort().map(function(g) {
      return { name: g, count: groupsSet[g] };
    });

    return groups;
  },

  /**
   * Prepares Single Card data for a given Kode Material or Row Index
   */
  getItemCardData: function(kodeOrRowIndex) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_PICTFINDER);
    if (!sheet) return null;

    const lastRow = sheet.getLastRow();
    if (lastRow < CONFIG.DATA_START_ROW) return null;

    let targetRow = -1;
    if (typeof kodeOrRowIndex === 'number' && kodeOrRowIndex >= CONFIG.DATA_START_ROW) {
      targetRow = kodeOrRowIndex;
    } else {
      const targetCode = String(kodeOrRowIndex || '').trim().toLowerCase();
      const numRows = lastRow - CONFIG.DATA_START_ROW + 1;
      const codes = sheet.getRange(CONFIG.DATA_START_ROW, CONFIG.COL.KODE_MATERIAL, numRows, 1).getValues();
      for (let i = 0; i < codes.length; i++) {
        if (String(codes[i][0]).trim().toLowerCase() === targetCode) {
          targetRow = CONFIG.DATA_START_ROW + i;
          break;
        }
      }
    }

    if (targetRow === -1) return null;

    const rowVals = sheet.getRange(targetRow, 1, 1, 9).getValues()[0];
    const kode = String(rowVals[CONFIG.COL.KODE_MATERIAL - 1] || '').trim();

    return {
      no: rowVals[CONFIG.COL.NO - 1],
      lokasiRak: rowVals[CONFIG.COL.LOKASI_RAK - 1] || '-',
      group: rowVals[CONFIG.COL.GROUP - 1] || '-',
      kodeMaterial: kode,
      namaBarang: rowVals[CONFIG.COL.NAMA_BARANG - 1] || '-',
      qty: rowVals[CONFIG.COL.QTY - 1] || '0',
      uom: rowVals[CONFIG.COL.UOM - 1] || '',
      deskripsi: rowVals[CONFIG.COL.DESKRIPSI - 1] || '',
      linkFoto: rowVals[CONFIG.COL.LINK_FOTO - 1] || '',
      barcodeValue: kode || 'NO-CODE',
      qrValue: kode || 'NO-CODE',
      isBlank: false
    };
  },

  /**
   * Prepares Group Card data with items belonging to that group
   */
  getGroupCardData: function(groupName) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_PICTFINDER);
    if (!sheet) return null;

    const cleanGroup = String(groupName || '').trim().toLowerCase();
    const lastRow = sheet.getLastRow();
    if (lastRow < CONFIG.DATA_START_ROW) return null;

    const numRows = lastRow - CONFIG.DATA_START_ROW + 1;
    const data = sheet.getRange(CONFIG.DATA_START_ROW, 1, numRows, 9).getValues();
    const groupItems = [];
    let groupDisplayName = groupName;

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const g = String(row[CONFIG.COL.GROUP - 1] || '').trim();
      if (g.toLowerCase() === cleanGroup) {
        groupDisplayName = g;
        groupItems.push({
          komat: row[CONFIG.COL.KODE_MATERIAL - 1] || '-',
          name: row[CONFIG.COL.NAMA_BARANG - 1] || '-',
          qty: row[CONFIG.COL.QTY - 1] || 0,
          uom: row[CONFIG.COL.UOM - 1] || ''
        });
      }
    }

    return {
      groupName: groupDisplayName || groupName,
      deskripsi: 'Kumpulan material dalam kelompok rak / grup ' + (groupDisplayName || groupName),
      items: groupItems,
      qrValue: 'GROUP:' + (groupDisplayName || groupName),
      isBlank: false
    };
  }
};
