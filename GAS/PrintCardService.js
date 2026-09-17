/**
 * Stock Card Data Engine (PrintCardService.js)
 * Prepares single item and group card datasets following the Tcard specifications.
 * Implements KPMscript native message prompt (ui.prompt) and server-rendered print workflow.
 */

const PrintCardService = {
  /**
   * Retrieves the target logo (Drive ID: 1UWZKajgW8l1vJX7pTL8kYuF7A6tprIjT)
   * 1. Priority 1: High-res embedded Base64 data URI from LogoUri.js (instant, offline, zero latency)
   * 2. Priority 2: Direct DriveApp extraction
   * 3. Priority 3: Direct Google Drive UC URL
   */
  getLogoDataUri: function() {
    const logoId = CONFIG.LOGO_ID || '1UWZKajgW8l1vJX7pTL8kYuF7A6tprIjT';

    // 1. Instant high-res embedded Base64 URI from LogoUri.js (exact 1UWZK logo)
    try {
      if (typeof getTargetLogoDataUri === 'function') {
        const uri = getTargetLogoDataUri();
        if (uri && uri.indexOf('data:image') === 0) return uri;
      }
      if (typeof TARGET_LOGO_DATA_URI !== 'undefined' && TARGET_LOGO_DATA_URI && TARGET_LOGO_DATA_URI.indexOf('data:image') === 0) {
        return TARGET_LOGO_DATA_URI;
      }
    } catch (e) {
      Logger.log('getLogoDataUri LogoUri.js notice: ' + e.message);
    }

    // 2. ScriptCache (KPMscript pattern)
    try {
      const cache = CacheService.getScriptCache();
      const cached = cache.get('APP_PRINT_LOGO_' + logoId);
      if (cached) return cached;
    } catch (e) {}

    // 3. Fallback: DriveApp fetch (KPMscript pattern)
    try {
      const file = DriveApp.getFileById(logoId);
      const blob = file.getBlob();
      const contentType = blob.getContentType();
      const base64 = Utilities.base64Encode(blob.getBytes());
      const dataUrl = 'data:' + contentType + ';base64,' + base64;
      try {
        if (dataUrl.length < 100000) {
          CacheService.getScriptCache().put('APP_PRINT_LOGO_' + logoId, dataUrl, 21600); // 6 hours
        }
      } catch (ce) {}
      return dataUrl;
    } catch (err) {
      Logger.log('getLogoDataUri DriveApp warning: ' + err.message);
    }

    // 4. Fallback Google Drive LH3 CDN direct URL
    return 'https://lh3.googleusercontent.com/d/' + logoId;
  },

  /**
   * Returns list of all materials for UI selection
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
      const noVal = row[CONFIG.COL.NO - 1];
      const kode = String(row[CONFIG.COL.KODE_MATERIAL - 1] || '').trim();
      const nama = String(row[CONFIG.COL.NAMA_BARANG - 1] || '').trim();
      const group = String(row[CONFIG.COL.GROUP - 1] || '').trim();
      const lokasi = String(row[CONFIG.COL.LOKASI_RAK - 1] || '').trim();

      if (kode || nama) {
        list.push({
          no: (noVal !== '' && noVal !== null && noVal !== undefined) ? noVal : (i + 1),
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
   * Returns list of all distinct Groups with their material items
   */
  getAllGroupsData: function() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_PICTFINDER);
    if (!sheet) return [];

    const lastRow = sheet.getLastRow();
    if (lastRow < CONFIG.DATA_START_ROW) return [];

    const numRows = lastRow - CONFIG.DATA_START_ROW + 1;
    const data = sheet.getRange(CONFIG.DATA_START_ROW, 1, numRows, 9).getValues();
    const groupMap = {};

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const g = String(row[CONFIG.COL.GROUP - 1] || '').trim();
      if (!g) continue;
      if (!groupMap[g]) {
        groupMap[g] = {
          name: g,
          groupName: g,
          deskripsi: 'Daftar Material Group ' + g,
          items: [],
          isBlank: false
        };
      }
      groupMap[g].items.push({
        komat: row[CONFIG.COL.KODE_MATERIAL - 1] || '-',
        name: row[CONFIG.COL.NAMA_BARANG - 1] || '-',
        qty: row[CONFIG.COL.QTY - 1] || 0,
        uom: row[CONFIG.COL.UOM - 1] || ''
      });
    }

    return Object.keys(groupMap).sort().map(function(k, idx) {
      const grp = groupMap[k];
      grp.index = idx + 1;
      return grp;
    });
  },

  /**
   * Returns list of all distinct Groups for UI selection
   */
  getAllGroupsList: function() {
    return this.getAllGroupsData();
  },

  /**
   * Parses numeric range string e.g. "1", "1-2", "1,3", "1-5" into array of numbers
   */
  parseNumericRange: function(input, maxNo) {
    if (!input || !String(input).trim()) return [1];
    const parts = String(input).split(/[,;\s]+/);
    const result = {};
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i].trim();
      if (!part) continue;
      if (part.indexOf('-') !== -1) {
        const sides = part.split('-');
        const start = parseInt(sides[0], 10);
        const end = parseInt(sides[1], 10);
        if (!isNaN(start) && !isNaN(end)) {
          const min = Math.min(start, end);
          const max = Math.max(start, end);
          for (let n = min; n <= max; n++) {
            if (n >= 1 && (!maxNo || n <= maxNo)) result[n] = true;
          }
        }
      } else {
        const n = parseInt(part, 10);
        if (!isNaN(n) && n >= 1 && (!maxNo || n <= maxNo)) result[n] = true;
      }
    }
    const numbers = Object.keys(result).map(function(k) { return parseInt(k, 10); });
    numbers.sort(function(a, b) { return a - b; });
    return numbers.length > 0 ? numbers : [1];
  },

  /**
   * Parses group range string e.g. "1", "1-2", "A-B", "1,3", "A,D" into array of group objects
   */
  parseGroupRange: function(input, allGroups) {
    if (!allGroups || allGroups.length === 0) return [];
    if (!input || !String(input).trim()) return [allGroups[0]];

    const cleanInput = String(input).trim();

    // 1. Check Letter Range e.g. A-B, A-D
    const letterRangeMatch = cleanInput.match(/^([a-zA-Z])-([a-zA-Z])$/);
    if (letterRangeMatch) {
      const startCode = letterRangeMatch[1].toUpperCase().charCodeAt(0);
      const endCode = letterRangeMatch[2].toUpperCase().charCodeAt(0);
      const minCode = Math.min(startCode, endCode);
      const maxCode = Math.max(startCode, endCode);
      const matched = [];
      for (let c = minCode; c <= maxCode; c++) {
        const char = String.fromCharCode(c);
        let found = null;
        for (let g = 0; g < allGroups.length; g++) {
          if ((allGroups[g].name || allGroups[g].groupName || '').toUpperCase() === char) {
            found = allGroups[g];
            break;
          }
        }
        if (found) {
          if (matched.indexOf(found) === -1) matched.push(found);
        } else {
          const idx = c - 65;
          if (idx >= 0 && idx < allGroups.length && matched.indexOf(allGroups[idx]) === -1) {
            matched.push(allGroups[idx]);
          }
        }
      }
      if (matched.length > 0) return matched;
    }

    // 2. Check Number Range e.g. 1-2, 1-3
    const numRange = this.parseNumericRange(cleanInput, allGroups.length);
    if (numRange.length > 0) {
      const matched = [];
      for (let i = 0; i < numRange.length; i++) {
        const idx = numRange[i] - 1;
        if (idx >= 0 && idx < allGroups.length) {
          matched.push(allGroups[idx]);
        }
      }
      if (matched.length > 0) return matched;
    }

    // 3. Comma list of letters, numbers, or group names e.g. A,D or 1,3
    const tokens = cleanInput.split(/[,;\s]+/);
    const matched = [];
    for (let t = 0; t < tokens.length; t++) {
      const token = tokens[t].trim();
      if (!token) continue;
      let found = null;
      for (let g = 0; g < allGroups.length; g++) {
        if ((allGroups[g].name || allGroups[g].groupName || '').toLowerCase() === token.toLowerCase()) {
          found = allGroups[g];
          break;
        }
      }
      if (found) {
        if (matched.indexOf(found) === -1) matched.push(found);
      } else {
        const num = parseInt(token, 10);
        if (!isNaN(num) && num >= 1 && num <= allGroups.length) {
          const grp = allGroups[num - 1];
          if (matched.indexOf(grp) === -1) matched.push(grp);
        }
      }
    }

    return matched.length > 0 ? matched : [allGroups[0]];
  },

  /**
   * Prompts user via native Sheets ui.prompt and opens Print Single Card view
   * (KPMscript pattern)
   */
  promptAndPrintSingle: function() {
    const ui = SpreadsheetApp.getUi();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_PICTFINDER);

    if (!sheet) {
      ui.alert('Peringatan', 'Sheet "' + CONFIG.SHEET_PICTFINDER + '" tidak ditemukan.', ui.ButtonSet.OK);
      return;
    }

    // Detect active row item No as default choice
    let defaultChoice = '1';
    try {
      const activeSheet = ss.getActiveSheet();
      if (activeSheet && activeSheet.getName() === CONFIG.SHEET_PICTFINDER) {
        const curRow = activeSheet.getActiveCell().getRow();
        if (curRow >= CONFIG.DATA_START_ROW) {
          const noVal = activeSheet.getRange(curRow, CONFIG.COL.NO).getValue();
          if (noVal !== '' && noVal !== null && noVal !== undefined) {
            defaultChoice = String(noVal).trim();
          }
        }
      }
    } catch (e) {}

    const promptMsg = 'Masukkan Nomor item yang ingin dicetak:\n\n' +
      'Format pilihan:\n' +
      '• Satu nomor: 1\n' +
      '• Rentang: 1-2 atau 1-4 atau 1-5\n' +
      '• Beberapa nomor: 1,3 atau 1,2,5\n\n' +
      '*Normalisasi A4: 4 kartu per lembar (slot kosong otomatis diisi kartu kosong)\n' +
      '(Tekan OK langsung untuk nomor default: "' + defaultChoice + '")';

    const response = ui.prompt('🏷️ Cetak Kartu Material (Single - 4/A4)', promptMsg, ui.ButtonSet.OK_CANCEL);
    if (response.getSelectedButton() !== ui.Button.OK) {
      return; // User clicked Cancel or closed
    }

    let input = response.getResponseText().trim();
    if (!input) input = defaultChoice;

    const printData = this.buildSinglePrintData(input);
    if (!printData || printData.pages.length === 0) {
      ui.alert('Peringatan', 'Tidak ada data material yang ditemukan untuk nomor: ' + input, ui.ButtonSet.OK);
      return;
    }

    this.openPrintView(printData);
  },

  /**
   * Prompts user via native Sheets ui.prompt and opens Print Group Card view
   * (KPMscript pattern)
   */
  promptAndPrintGroup: function() {
    const ui = SpreadsheetApp.getUi();
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_PICTFINDER);

    if (!sheet) {
      ui.alert('Peringatan', 'Sheet "' + CONFIG.SHEET_PICTFINDER + '" tidak ditemukan.', ui.ButtonSet.OK);
      return;
    }

    // Detect active row Group as default choice
    let defaultChoice = '1';
    try {
      const activeSheet = ss.getActiveSheet();
      if (activeSheet && activeSheet.getName() === CONFIG.SHEET_PICTFINDER) {
        const curRow = activeSheet.getActiveCell().getRow();
        if (curRow >= CONFIG.DATA_START_ROW) {
          const grpVal = activeSheet.getRange(curRow, CONFIG.COL.GROUP).getValue();
          if (grpVal !== '' && grpVal !== null && grpVal !== undefined) {
            defaultChoice = String(grpVal).trim();
          }
        }
      }
    } catch (e) {}

    const promptMsg = 'Masukkan Group yang ingin dicetak:\n\n' +
      'Format pilihan:\n' +
      '• Satu group: 1 atau A\n' +
      '• Rentang: 1-2 atau A-B\n' +
      '• Beberapa group: 1,3 atau A,D\n\n' +
      '*Normalisasi A4: 2 kartu per lembar (slot sisa otomatis diisi kartu group kosong)\n' +
      '(Tekan OK langsung untuk group default: "' + defaultChoice + '")';

    const response = ui.prompt('📦 Cetak Kartu Group (Group - 2/A4)', promptMsg, ui.ButtonSet.OK_CANCEL);
    if (response.getSelectedButton() !== ui.Button.OK) {
      return; // User clicked Cancel or closed
    }

    let input = response.getResponseText().trim();
    if (!input) input = defaultChoice;

    const printData = this.buildGroupPrintData(input);
    if (!printData || printData.pages.length === 0) {
      ui.alert('Peringatan', 'Tidak ada data group yang ditemukan untuk: ' + input, ui.ButtonSet.OK);
      return;
    }

    this.openPrintView(printData);
  },

  /**
   * Prepares Single Card print dataset normalized to full A4 sheets (4 cards per A4 page)
   */
  buildSinglePrintData: function(rangeInput) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_PICTFINDER);
    if (!sheet) return null;

    const lastRow = sheet.getLastRow();
    if (lastRow < CONFIG.DATA_START_ROW) return null;

    const numRows = lastRow - CONFIG.DATA_START_ROW + 1;
    const values = sheet.getRange(CONFIG.DATA_START_ROW, 1, numRows, 9).getValues();

    // Map rows by No
    const itemMapByNo = {};
    const allMaterials = [];
    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      const noVal = row[CONFIG.COL.NO - 1];
      const noNum = (noVal !== '' && noVal !== null && noVal !== undefined) ? parseInt(noVal, 10) : (i + 1);
      const kode = String(row[CONFIG.COL.KODE_MATERIAL - 1] || '').trim();
      const nama = String(row[CONFIG.COL.NAMA_BARANG - 1] || '').trim();

      const itemObj = {
        no: noNum,
        rowIndex: CONFIG.DATA_START_ROW + i,
        kodeMaterial: kode || ('ITEM-' + noNum),
        namaBarang: nama || '-',
        spesifikasi: String(row[CONFIG.COL.DESKRIPSI - 1] || '').trim(),
        lokasiRak: String(row[CONFIG.COL.LOKASI_RAK - 1] || '-').trim(),
        group: String(row[CONFIG.COL.GROUP - 1] || '-').trim(),
        satuan: String(row[CONFIG.COL.UOM - 1] || 'PCS').trim(),
        qty: row[CONFIG.COL.QTY - 1] || 0,
        linkFoto: String(row[CONFIG.COL.LINK_FOTO - 1] || '').trim(),
        barcodeValue: kode || ('ITEM-' + noNum),
        isBlank: false
      };

      itemMapByNo[noNum] = itemObj;
      allMaterials.push(itemObj);
    }

    const selectedNos = this.parseNumericRange(rangeInput, allMaterials.length);
    const selectedItems = [];
    for (let s = 0; s < selectedNos.length; s++) {
      const n = selectedNos[s];
      if (itemMapByNo[n]) {
        selectedItems.push(itemMapByNo[n]);
      }
    }

    if (selectedItems.length === 0) return null;

    // Normalization to 4 cards per A4 page
    const totalFilled = selectedItems.length;
    const targetCardCount = Math.max(4, Math.ceil(totalFilled / 4) * 4);
    const blankCount = targetCardCount - totalFilled;

    const allCards = selectedItems.slice();
    for (let b = 0; b < blankCount; b++) {
      allCards.push({
        no: '',
        rowIndex: 0,
        kodeMaterial: '',
        namaBarang: '',
        spesifikasi: '',
        lokasiRak: '',
        group: '',
        satuan: '',
        qty: '',
        linkFoto: '',
        barcodeValue: '',
        isBlank: true
      });
    }

    // Chunk into A4 pages (4 cards each)
    const pages = [];
    const totalPages = allCards.length / 4;
    for (let p = 0; p < totalPages; p++) {
      pages.push({
        pageNumber: p + 1,
        totalPages: totalPages,
        cards: allCards.slice(p * 4, (p + 1) * 4)
      });
    }

    const summaryStr = totalPages + ' Lembar A4 (' + totalFilled + ' Kartu + ' + blankCount + ' Blank)';

    return {
      mode: 'single',
      title: 'Cetak Kartu Material (Single - 4/A4)',
      summary: summaryStr,
      logoUrl: this.getLogoDataUri(),
      pages: pages
    };
  },

  /**
   * Prepares Group Card print dataset normalized to full A4 sheets (2 cards per A4 page)
   */
  buildGroupPrintData: function(rangeInput) {
    const allGroups = this.getAllGroupsData();
    if (!allGroups || allGroups.length === 0) return null;

    const selectedGroups = this.parseGroupRange(rangeInput, allGroups);
    if (selectedGroups.length === 0) return null;

    // Normalization to 2 cards per A4 page
    const totalFilled = selectedGroups.length;
    const targetCardCount = Math.max(2, Math.ceil(totalFilled / 2) * 2);
    const blankCount = targetCardCount - totalFilled;

    const allCards = [];
    for (let i = 0; i < selectedGroups.length; i++) {
      const grp = selectedGroups[i];
      allCards.push({
        groupName: grp.groupName || grp.name || '-',
        deskripsi: grp.deskripsi || ('Daftar Material Group ' + (grp.groupName || grp.name || '')),
        items: grp.items || [],
        qrValue: 'GROUP:' + (grp.groupName || grp.name || ''),
        isBlank: false
      });
    }

    for (let b = 0; b < blankCount; b++) {
      allCards.push({
        groupName: '',
        deskripsi: '',
        items: [],
        qrValue: '',
        isBlank: true
      });
    }

    // Chunk into A4 pages (2 cards each)
    const pages = [];
    const totalPages = allCards.length / 2;
    for (let p = 0; p < totalPages; p++) {
      pages.push({
        pageNumber: p + 1,
        totalPages: totalPages,
        cards: allCards.slice(p * 2, (p + 1) * 2)
      });
    }

    const summaryStr = totalPages + ' Lembar A4 (' + totalFilled + ' Group + ' + blankCount + ' Blank)';

    return {
      mode: 'group',
      title: 'Cetak Kartu Group (Group - 2/A4)',
      summary: summaryStr,
      logoUrl: this.getLogoDataUri(),
      pages: pages
    };
  },

  /**
   * Opens the server-rendered print-ready modal dialog (KPMscript pattern)
   */
  openPrintView: function(data) {
    const template = HtmlService.createTemplateFromFile('PrintCardModal');
    template.data = data;

    const htmlOutput = template.evaluate()
      .setWidth(1120)
      .setHeight(840);

    const dialogTitle = data.title + ' • ' + data.summary;
    SpreadsheetApp.getUi().showModalDialog(htmlOutput, dialogTitle);
  }
};
