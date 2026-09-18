/**
 * Stock Card Data Engine (PrintCardService.js)
 * Prepares single material card datasets following the Tcard specifications.
 * Implements KPMscript native message prompt (ui.prompt) and server-rendered print workflow.
 */

const PrintCardService = {
  /**
   * Retrieves the official corporate logo:
   * 1. Priority 1: High-res embedded Base64 data URI from LogoUri.js (official PT REKAINDO GLOBAL JASA / REKA INKA Group)
   * 2. Priority 2: Check if Tcard sheet has an embedded image directly placed on the sheet
   * 3. Priority 3: Custom DriveApp LOGO_ID (if explicitly configured and not the old school ID)
   * 4. Priority 4: KPMscript native vector SVG badge (fill="#16233B" REKAINDO)
   */
  getLogoDataUri: function() {
    const defaultSvgLogo = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='50' viewBox='0 0 120 50'><rect width='120' height='50' fill='%2316233B' rx='4'/><text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' font-family='sans-serif' font-size='12' font-weight='bold' fill='%23FFFFFF'>REKAINDO</text></svg>";

    // 1. Instant high-res embedded Base64 URI from LogoUri.js (official REKA INKA Group logo)
    try {
      if (typeof getRekaindoLogoDataUri === 'function') {
        const uri = getRekaindoLogoDataUri();
        if (uri && uri.indexOf('data:image') === 0) return uri;
      }
      if (typeof getTargetLogoDataUri === 'function') {
        const uri = getTargetLogoDataUri();
        if (uri && uri.indexOf('data:image') === 0) return uri;
      }
      if (typeof REKAINDO_LOGO_DATA_URI !== 'undefined' && REKAINDO_LOGO_DATA_URI && REKAINDO_LOGO_DATA_URI.indexOf('data:image') === 0) {
        return REKAINDO_LOGO_DATA_URI;
      }
      if (typeof TARGET_LOGO_DATA_URI !== 'undefined' && TARGET_LOGO_DATA_URI && TARGET_LOGO_DATA_URI.indexOf('data:image') === 0) {
        return TARGET_LOGO_DATA_URI;
      }
    } catch (e) {
      Logger.log('getLogoDataUri LogoUri.js notice: ' + e.message);
    }

    // 2. Check if Tcard sheet has an embedded image placed directly by user
    try {
      const ss = getSpreadsheetInstance();
      const tcardSheet = ss.getSheetByName(CONFIG.SHEET_TCARD);
      if (tcardSheet) {
        const images = tcardSheet.getImages();
        if (images && images.length > 0) {
          const blob = images[0].getBlob();
          const contentType = blob.getContentType();
          const base64 = Utilities.base64Encode(blob.getBytes());
          return 'data:' + contentType + ';base64,' + base64;
        }
      }
    } catch (e) {
      Logger.log('Tcard sheet image check warning: ' + e.message);
    }

    // 3. Fallback: DriveApp fetch if custom logoId configured (ignoring old school ID)
    const logoId = CONFIG.LOGO_ID;
    if (logoId && logoId !== '1UWZKajgW8l1vJX7pTL8kYuF7A6tprIjT' && logoId !== 'PASTE_YOUR_LOGO_FILE_ID_HERE') {
      try {
        const cache = CacheService.getScriptCache();
        const cached = cache.get('APP_PRINT_LOGO_' + logoId);
        if (cached) return cached;
      } catch (e) {}

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
    }

    // 4. Default fallback: Clean SVG badge matching KPMscript pattern
    return defaultSvgLogo;
  },

  /**
   * Returns list of all materials for UI selection
   */
  getAllMaterialsList: function() {
    const ss = getSpreadsheetInstance();
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

      const hasContent = row.slice(1, 9).some(function(v) {
        return v !== '' && v !== null && v !== undefined && String(v).trim() !== '';
      });

      if (hasContent || noVal) {
        list.push({
          no: (noVal !== '' && noVal !== null && noVal !== undefined) ? parseInt(noVal, 10) : (i + 1),
          rowIndex: CONFIG.DATA_START_ROW + i,
          kodeMaterial: kode || ('ITEM-' + (i + 1)),
          namaBarang: nama || '-',
          group: group,
          lokasiRak: lokasi
        });
      }
    }

    return list;
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
   * Prompts user via native Sheets ui.prompt and opens Print Single Card view
   * (KPMscript pattern)
   */
  promptAndPrintSingle: function() {
    const ui = SpreadsheetApp.getUi();
    const ss = getSpreadsheetInstance();
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

    const response = ui.prompt('🏷️ Cetak Kartu Material (4/A4)', promptMsg, ui.ButtonSet.OK_CANCEL);
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
   * Prepares Single Card print dataset normalized to full A4 sheets (4 cards per A4 page)
   */
  buildSinglePrintData: function(rangeInput) {
    const ss = getSpreadsheetInstance();
    const sheet = ss.getSheetByName(CONFIG.SHEET_PICTFINDER);
    if (!sheet) return null;

    const lastRow = Math.max(sheet.getLastRow(), CONFIG.DATA_START_ROW);
    const numRows = lastRow - CONFIG.DATA_START_ROW + 1;
    const values = sheet.getRange(CONFIG.DATA_START_ROW, 1, numRows, 9).getValues();

    // Map rows by No
    const itemMapByNo = {};
    const allMaterials = [];
    let maxKnownNo = 0;

    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      const noVal = row[CONFIG.COL.NO - 1];
      const noNum = (noVal !== '' && noVal !== null && noVal !== undefined) ? parseInt(noVal, 10) : (i + 1);
      if (noNum > maxKnownNo) maxKnownNo = noNum;

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

    const selectedNos = this.parseNumericRange(rangeInput, Math.max(500, maxKnownNo + 20));
    const selectedItems = [];
    for (let s = 0; s < selectedNos.length; s++) {
      const n = selectedNos[s];
      if (itemMapByNo[n]) {
        selectedItems.push(itemMapByNo[n]);
      } else {
        selectedItems.push({
          no: n,
          rowIndex: 0,
          kodeMaterial: 'ITEM-' + n,
          namaBarang: '-',
          spesifikasi: '',
          lokasiRak: '-',
          group: '-',
          satuan: 'PCS',
          qty: 0,
          linkFoto: '',
          barcodeValue: 'ITEM-' + n,
          isBlank: false
        });
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

    const logoUri = this.getLogoDataUri();

    return {
      mode: 'single',
      title: 'Cetak Kartu Material (4/A4)',
      summary: summaryStr,
      logo: logoUri,
      logoUrl: logoUri,
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
