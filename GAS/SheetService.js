/**
 * Google Sheet Service
 * Provides dynamic column mapping, row searches, and concurrency-safe writes.
 */
const SheetService = {
  getSheet: function() {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    if (!sheet) {
      throw new Error('Sheet "' + CONFIG.SHEET_NAME + '" tidak ditemukan pada Spreadsheet.');
    }
    return sheet;
  },

  /**
   * Dynamically inspects row 1 and maps logical column keys to 1-based column indices.
   */
  getColumnMap: function(sheet) {
    const lastCol = sheet.getLastColumn();
    if (lastCol < 1) {
      throw new Error('Sheet kosong atau tidak memiliki baris header.');
    }

    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const map = {};

    function normalize(str) {
      return String(str || '').toLowerCase().replace(/[\s\-_]+/g, '');
    }

    const normalizedHeaders = headers.map(normalize);

    for (const [key, keywords] of Object.entries(CONFIG.COLUMNS)) {
      let foundCol = -1;
      for (let i = 0; i < normalizedHeaders.length; i++) {
        const h = normalizedHeaders[i];
        for (const kw of keywords) {
          if (h === normalize(kw)) {
            foundCol = i + 1; // 1-based index
            break;
          }
        }
        if (foundCol !== -1) break;
      }
      map[key] = foundCol;
    }

    return {
      map: map,
      totalCols: lastCol
    };
  },

  /**
   * Optimized lookup scanning ONLY the Material Code column range.
   */
  findRowByMaterialCode: function(sheet, colIndex, materialCode) {
    if (!materialCode || colIndex < 1) return -1;
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return -1;

    const target = String(materialCode).trim().toLowerCase();
    const values = sheet.getRange(2, colIndex, lastRow - 1, 1).getValues();

    for (let i = 0; i < values.length; i++) {
      if (String(values[i][0]).trim().toLowerCase() === target) {
        return i + 2; // 1-based row index in sheet
      }
    }
    return -1;
  },

  /**
   * Insert new item with LockService concurrency control
   */
  addItem: function(formData) {
    const lock = LockService.getScriptLock();
    lock.waitLock(CONFIG.LOCK_TIMEOUT_MS);

    try {
      const sheet = this.getSheet();
      const colInfo = this.getColumnMap(sheet);
      const colMap = colInfo.map;
      const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);

      let link1 = uploadFileToDrive(formData.foto1, folder);
      let link2 = uploadFileToDrive(formData.foto2, folder);
      let linkGabungan = uploadFileToDrive(formData.fotoGabungan, folder);

      // Build row array matching total sheet columns
      const rowData = new Array(colInfo.totalCols).fill('');

      function setCol(key, val) {
        const idx = colMap[key];
        if (idx && idx > 0) {
          rowData[idx - 1] = (val !== undefined && val !== null) ? val : '';
        }
      }

      setCol('LOKASI_RAK', formData.lokasiRak);
      setCol('KODE_MATERIAL', formData.kodeMaterial);
      setCol('NAMA_BARANG', formData.namaBarang);
      setCol('QTY', formData.qty);
      setCol('UOM', formData.uom);
      setCol('DESKRIPSI', formData.deskripsi);
      setCol('FOTO1', link1);
      setCol('FOTO2', link2);
      setCol('FOTO_GABUNGAN', linkGabungan);

      sheet.appendRow(rowData);

      return {
        success: true,
        message: 'Data berhasil disimpan!',
        data: {
          kodeMaterial: formData.kodeMaterial,
          row: sheet.getLastRow()
        }
      };
    } finally {
      lock.releaseLock();
    }
  },

  /**
   * Update existing item with LockService concurrency control
   */
  updateItem: function(data) {
    const lock = LockService.getScriptLock();
    lock.waitLock(CONFIG.LOCK_TIMEOUT_MS);

    try {
      const sheet = this.getSheet();
      const colInfo = this.getColumnMap(sheet);
      const colMap = colInfo.map;

      const kodeCol = colMap['KODE_MATERIAL'];
      if (!kodeCol || kodeCol < 1) {
        throw new Error('Kolom "Kode Material" tidak ditemukan pada sheet.');
      }

      const targetCode = data.kodeMaterialAsli || data.kodeMaterial;
      const rowIndex = this.findRowByMaterialCode(sheet, kodeCol, targetCode);

      if (rowIndex === -1) {
        return {
          success: false,
          message: 'Data dengan Kode Material "' + targetCode + '" tidak ditemukan.'
        };
      }

      const folder = DriveApp.getFolderById(CONFIG.DRIVE_FOLDER_ID);
      const currentRow = sheet.getRange(rowIndex, 1, 1, colInfo.totalCols).getValues()[0];

      function getExisting(key) {
        const idx = colMap[key];
        return (idx && idx > 0) ? currentRow[idx - 1] : '';
      }

      let link1 = getExisting('FOTO1');
      let link2 = getExisting('FOTO2');
      let linkGabungan = getExisting('FOTO_GABUNGAN');

      if (!data.keepFoto1 && data.foto1 && data.foto1.base64) {
        link1 = uploadFileToDrive(data.foto1, folder);
      }
      if (!data.keepFoto2 && data.foto2 && data.foto2.base64) {
        link2 = uploadFileToDrive(data.foto2, folder);
      }
      if (!data.keepFotoGabungan && data.fotoGabungan && data.fotoGabungan.base64) {
        linkGabungan = uploadFileToDrive(data.fotoGabungan, folder);
      }

      const updatedRow = [...currentRow];

      function updateCol(key, val) {
        const idx = colMap[key];
        if (idx && idx > 0) {
          updatedRow[idx - 1] = (val !== undefined && val !== null) ? val : '';
        }
      }

      updateCol('LOKASI_RAK', data.lokasiRak);
      updateCol('KODE_MATERIAL', data.kodeMaterial);
      updateCol('NAMA_BARANG', data.namaBarang);
      updateCol('QTY', data.qty);
      updateCol('UOM', data.uom);
      updateCol('DESKRIPSI', data.deskripsi);
      updateCol('FOTO1', link1);
      updateCol('FOTO2', link2);
      updateCol('FOTO_GABUNGAN', linkGabungan);

      sheet.getRange(rowIndex, 1, 1, colInfo.totalCols).setValues([updatedRow]);

      return {
        success: true,
        message: 'Data berhasil diperbarui!',
        data: {
          kodeMaterial: data.kodeMaterial,
          row: rowIndex
        }
      };
    } finally {
      lock.releaseLock();
    }
  },

  /**
   * Fast 0-second live inventory read returning all items with original column headers
   */
  getAllItems: function() {
    const sheet = this.getSheet();
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();

    if (lastRow < 2 || lastCol < 1) {
      return [];
    }

    const data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
    const headers = data[0].map(function(h) { return String(h || '').trim(); });
    const items = [];

    for (let r = 1; r < data.length; r++) {
      const row = data[r];
      let hasData = false;
      for (let c = 0; c < row.length; c++) {
        if (row[c] !== '' && row[c] !== null && row[c] !== undefined) {
          hasData = true;
          break;
        }
      }

      if (hasData) {
        const itemObj = {};
        for (let c = 0; c < headers.length; c++) {
          const headerName = headers[c] || ('Column_' + (c + 1));
          itemObj[headerName] = row[c];
        }
        items.push(itemObj);
      }
    }

    return items;
  },

  /**
   * Connects to or auto-initializes the "Users" sheet
   */
  getUsersSheet: function() {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let userSheet = ss.getSheetByName(CONFIG.USER_SHEET_NAME);

    if (!userSheet) {
      userSheet = ss.insertSheet(CONFIG.USER_SHEET_NAME);
      userSheet.appendRow(['Username', 'PasswordHash', 'Role', 'Status', 'CreatedAt']);
      userSheet.appendRow(['admin', CONFIG.DEFAULT_ADMIN_HASH, 'admin', 'Active', new Date().toISOString()]);
      userSheet.appendRow(['staff', CONFIG.DEFAULT_STAFF_HASH, 'staff', 'Active', new Date().toISOString()]);
      userSheet.getRange(1, 1, 1, 5).setFontWeight('bold');
    }

    return userSheet;
  },

  /**
   * Verifies user credentials against the "Users" sheet
   */
  verifyUser: function(username, passwordHash) {
    if (!username || !passwordHash) {
      return { success: false, message: 'Username dan password wajib diisi.' };
    }

    const cleanUsername = String(username).trim().toLowerCase();
    const sheet = this.getUsersSheet();
    const lastRow = sheet.getLastRow();

    if (lastRow < 2) {
      return { success: false, message: 'Tidak ada data user terdaftar.' };
    }

    const values = sheet.getRange(2, 1, lastRow - 1, 4).getValues();
    for (let i = 0; i < values.length; i++) {
      const u = String(values[i][0]).trim().toLowerCase();
      const p = String(values[i][1]).trim();
      const role = String(values[i][2]).trim().toLowerCase() || 'staff';
      const status = String(values[i][3]).trim().toLowerCase();

      if (u === cleanUsername) {
        if (status && status !== 'active') {
          return { success: false, message: 'Akun dinonaktifkan. Hubungi administrator.' };
        }
        if (p === String(passwordHash).trim()) {
          return {
            success: true,
            user: {
              username: values[i][0],
              role: role,
              loggedInAt: new Date().getTime()
            }
          };
        } else {
          return { success: false, message: 'Password salah.' };
        }
      }
    }

    return { success: false, message: 'Username tidak ditemukan.' };
  }
};
