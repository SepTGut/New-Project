/**
 * User & Authentication Management (UserService.js)
 * Manages dynamic user accounts, auto-generates Login QR formulas,
 * and hides IIT/IT accounts from being shown or printed.
 */

const UserService = {
  /**
   * Initializes or repairs the User sheet with required roles and QR formulas.
   * If accounts already exist, it preserves them and only updates formatting/missing QR formulas.
   */
  setupUsersSheet: function() {
    const ss = getSpreadsheetInstance();
    let sheet = ss.getSheetByName(CONFIG.SHEET_USER);

    if (!sheet) {
      sheet = ss.insertSheet(CONFIG.SHEET_USER);
    }

    const headers = ['No', 'Nama Lengkap', 'Username', 'Role', 'Pseudo Email', 'Password', 'Status', 'Phone Number', 'QR Code Login'];

    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#1A237E')
      .setFontColor('#FFFFFF')
      .setFontFamily('Arial')
      .setFontSize(10)
      .setFontWeight('bold')
      .setHorizontalAlignment('center')
      .setVerticalAlignment('middle');
    sheet.setRowHeight(1, 32);

    const lastRow = sheet.getLastRow();

    // If sheet is new/empty, seed default accounts (Admin, User, IIT)
    if (lastRow < 2) {
      const defaultUsers = [
        {
          no: 1,
          name: 'System Administrator',
          username: 'admin',
          role: 'Admin',
          email: 'admin@gudang.local',
          pass: 'admin123',
          status: 'Active',
          phone: ''
        },
        {
          no: 2,
          name: 'Warehouse Operator',
          username: 'user1',
          role: 'User',
          email: 'user@gudang.local',
          pass: 'user123',
          status: 'Active',
          phone: ''
        },
        {
          no: 3,
          name: 'IT Support & Systems (Hidden)',
          username: 'iit_lead',
          role: 'IIT',
          email: 'iit@gudang.local',
          pass: 'iit2026!',
          status: 'Active',
          phone: ''
        }
      ];

      for (let i = 0; i < defaultUsers.length; i++) {
        const u = defaultUsers[i];
        const rowIdx = i + 2;

        sheet.getRange(rowIdx, 1, 1, 8).setValues([[
          u.no,
          u.name,
          u.username,
          u.role,
          u.email,
          u.pass,
          u.status,
          u.phone
        ]]);

        const qrPayload = JSON.stringify({ u: u.username, p: u.pass, role: u.role });
        const qrFormula = '=IMAGE("https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=' + encodeURIComponent(qrPayload) + '")';
        sheet.getRange(rowIdx, 9).setFormula(qrFormula);
        sheet.setRowHeight(rowIdx, 65);

        // Hide IIT / IT account row in spreadsheet
        if (u.role.toLowerCase() === 'iit' || u.role.toLowerCase() === 'it' || u.username.toLowerCase().startsWith('iit')) {
          sheet.hideRows(rowIdx);
        }
      }
    } else {
      // Existing accounts: preserve user edits, sync No, QR formula, and hide IT row
      for (let r = 2; r <= lastRow; r++) {
        const rowVals = sheet.getRange(r, 1, 1, 8).getValues()[0];
        const username = String(rowVals[2] || '').trim();
        const role = String(rowVals[3] || 'User').trim();
        const pass = String(rowVals[5] || '').trim();

        if (username) {
          const qrPayload = JSON.stringify({ u: username, p: pass, role: role });
          const qrFormula = '=IMAGE("https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=' + encodeURIComponent(qrPayload) + '")';
          sheet.getRange(r, 9).setFormula(qrFormula);
          sheet.setRowHeight(r, 65);

          // Hide IT account in spreadsheet
          if (role.toLowerCase() === 'iit' || role.toLowerCase() === 'it' || username.toLowerCase().startsWith('iit')) {
            sheet.hideRows(r);
          } else {
            sheet.showRows(r);
          }
        }
      }
    }

    const totalUsers = Math.max(1, sheet.getLastRow() - 1);

    // Alignments & widths
    sheet.getRange(2, 1, totalUsers, 1).setHorizontalAlignment('center');
    sheet.getRange(2, 3, totalUsers, 1).setHorizontalAlignment('center');
    sheet.getRange(2, 4, totalUsers, 1).setHorizontalAlignment('center').setFontWeight('bold');
    sheet.getRange(2, 5, totalUsers, 1).setHorizontalAlignment('left');
    sheet.getRange(2, 6, totalUsers, 1).setHorizontalAlignment('center');
    sheet.getRange(2, 7, totalUsers, 1).setHorizontalAlignment('center');
    sheet.getRange(2, 8, totalUsers, 1).setHorizontalAlignment('center').setNumberFormat('@');
    sheet.getRange(2, 9, totalUsers, 1).setHorizontalAlignment('center');

    sheet.setColumnWidth(1, 45);
    sheet.setColumnWidth(2, 180);
    sheet.setColumnWidth(3, 110);
    sheet.setColumnWidth(4, 90);
    sheet.setColumnWidth(5, 170);
    sheet.setColumnWidth(6, 110);
    sheet.setColumnWidth(7, 85);
    sheet.setColumnWidth(8, 140);
    sheet.setColumnWidth(9, 110);

    // Borders
    sheet.getRange(1, 1, totalUsers + 1, headers.length)
      .setBorder(true, true, true, true, true, true, '#D0D5DD', SpreadsheetApp.BorderStyle.SOLID);

    try {
      ss.toast('Sheet ' + CONFIG.SHEET_USER + ' berhasil disinkronisasi (Kolom Phone Number aktif).', 'Sukses', 5);
    } catch (e) {}
  },

  /**
   * Retrieves users list formatted for badge card printing.
   * STRICTLY EXCLUDES IT / IIT accounts so they cannot be seen or printed.
   */
  getAllUsersForPrint: function() {
    const ss = getSpreadsheetInstance();
    const sheet = ss.getSheetByName(CONFIG.SHEET_USER);
    if (!sheet) return [];

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    const colMap = getUserSheetColMap(sheet);
    const maxCols = Math.max(colMap.totalCols, 9);
    const data = sheet.getRange(2, 1, lastRow - 1, maxCols).getValues();
    const users = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const username = String(row[2] || '').trim();
      const role = String(row[3] || 'User').trim();

      // HIDE IT / IIT ACCOUNTS FROM ALL PRINTING & VIEWS
      if (role.toLowerCase() === 'iit' || role.toLowerCase() === 'it' || username.toLowerCase().startsWith('iit')) {
        continue;
      }

      if (username) {
        const payload = JSON.stringify({ u: username, p: String(row[5] || '').trim(), role: role });
        const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encodeURIComponent(payload);
        users.push({
          no: row[0] || (i + 1),
          name: row[1] || username,
          username: username,
          role: role,
          email: row[4] || '-',
          status: row[6] || 'Active',
          phone: String(row[colMap.phoneCol - 1] || ''),
          qrUrl: qrUrl
        });
      }
    }

    return users;
  },

  /**
   * Verifies username and password against the User sheet.
   * Supports both plain text password and SHA-256 hash matching.
   */
  verifyUser: function(username, password, passwordHash) {
    if (!username || (!password && !passwordHash)) {
      return { success: false, error: 'Username dan password wajib diisi.' };
    }
    const cleanUser = String(username).trim().toLowerCase();
    const cleanPass = String(password || '').trim();
    const targetHash = String(passwordHash || '').trim().toLowerCase();

    const ss = getSpreadsheetInstance();
    const sheet = ss.getSheetByName(CONFIG.SHEET_USER);
    if (!sheet) {
      return { success: false, error: 'Sheet "' + CONFIG.SHEET_USER + '" tidak ditemukan.' };
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { success: false, error: 'Tidak ada data akun pada sistem.' };
    }

    const colMap = getUserSheetColMap(sheet);
    const maxCols = Math.max(colMap.totalCols, 9);
    const values = sheet.getRange(2, 1, lastRow - 1, maxCols).getValues();

    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      const u = String(row[2] || '').trim().toLowerCase();
      const p = String(row[5] || '').trim();
      const status = String(row[6] || 'Active').trim().toLowerCase();

      if (u === cleanUser) {
        if (status === 'inactive' || status === 'nonaktif') {
          return { success: false, error: 'Akun Anda dinonaktifkan.' };
        }

        // Match either plain password or computed SHA-256 hash
        let isMatch = false;
        if (cleanPass && p === cleanPass) {
          isMatch = true;
        } else if (targetHash) {
          if (p.toLowerCase() === targetHash) {
            isMatch = true;
          } else {
            const computed = computeSha256(p);
            if (computed === targetHash) {
              isMatch = true;
            }
          }
        } else if (cleanPass) {
          const computed = computeSha256(cleanPass);
          if (p.toLowerCase() === computed) {
            isMatch = true;
          }
        }

        if (isMatch) {
          return {
            success: true,
            user: {
              no: row[0] || (i + 1),
              name: String(row[1] || row[2]),
              username: String(row[2]),
              role: String(row[3] || 'User'),
              email: String(row[4] || ''),
              phone: String(row[colMap.phoneCol - 1] || '')
            }
          };
        } else {
          return { success: false, error: 'Password tidak sesuai.' };
        }
      }
    }
    return { success: false, error: 'Username "' + username + '" tidak ditemukan.' };
  },

  /**
   * Retrieves a user by their registered WhatsApp phone number.
   * Scans the Phone Number column for a normalized phone match.
   */
  getUserByPhone: function(phoneNumber) {
    if (!phoneNumber) {
      return { success: false, error: 'Nomor telepon tidak boleh kosong.' };
    }
    const targetPhone = normalizePhone(phoneNumber);
    if (!targetPhone) {
      return { success: false, error: 'Format nomor telepon tidak valid.' };
    }

    const ss = getSpreadsheetInstance();
    const sheet = ss.getSheetByName(CONFIG.SHEET_USER);
    if (!sheet) {
      return { success: false, error: 'Sheet "' + CONFIG.SHEET_USER + '" tidak ditemukan.' };
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { success: false, error: 'Tidak ada data akun pada sistem.' };
    }

    const colMap = getUserSheetColMap(sheet);
    const maxCols = Math.max(colMap.totalCols, 9);
    const values = sheet.getRange(2, 1, lastRow - 1, maxCols).getValues();

    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      const status = String(row[6] || 'Active').trim().toLowerCase();
      if (status === 'inactive' || status === 'nonaktif') continue;

      const rowPhone = normalizePhone(row[colMap.phoneCol - 1]);
      if (rowPhone && rowPhone === targetPhone) {
        return {
          success: true,
          user: {
            no: row[0] || (i + 1),
            name: String(row[1] || row[2]),
            username: String(row[2]),
            role: String(row[3] || 'User'),
            email: String(row[4] || ''),
            status: String(row[6] || 'Active'),
            phone: rowPhone
          }
        };
      }
    }
    return { success: false, error: 'Nomor ' + targetPhone + ' belum terdaftar.' };
  },

  /**
   * Returns all active phone -> user mappings for high-performance bot caching.
   */
  getAllPhoneMappings: function() {
    const ss = getSpreadsheetInstance();
    const sheet = ss.getSheetByName(CONFIG.SHEET_USER);
    if (!sheet) return { success: false, error: 'Sheet not found', list: [] };

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: true, list: [] };

    const colMap = getUserSheetColMap(sheet);
    const maxCols = Math.max(colMap.totalCols, 9);
    const values = sheet.getRange(2, 1, lastRow - 1, maxCols).getValues();
    const list = [];

    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      const status = String(row[6] || 'Active').trim().toLowerCase();
      if (status === 'inactive' || status === 'nonaktif') continue;

      const rowPhone = normalizePhone(row[colMap.phoneCol - 1]);
      if (rowPhone) {
        list.push({
          phone: rowPhone,
          username: String(row[2] || ''),
          name: String(row[1] || row[2] || ''),
          role: String(row[3] || 'User'),
          email: String(row[4] || ''),
          status: String(row[6] || 'Active')
        });
      }
    }
    return { success: true, list: list };
  },

  /**
   * Adds a phone number to a user account.
   * If the account's existing row has no phone, it updates that cell.
   * If the account already has a phone, it duplicates the row for the new number.
   */
  addPhoneNumber: function(username, phoneNumber) {
    if (!username || !phoneNumber) {
      return { success: false, error: 'Username dan nomor telepon wajib diisi.' };
    }
    const cleanUser = String(username).trim().toLowerCase();
    const targetPhone = normalizePhone(phoneNumber);
    if (!targetPhone || targetPhone.length < 8) {
      return { success: false, error: 'Format nomor telepon tidak valid (minimal 8 digit).' };
    }

    const ss = getSpreadsheetInstance();
    const sheet = ss.getSheetByName(CONFIG.SHEET_USER);
    if (!sheet) {
      return { success: false, error: 'Sheet "' + CONFIG.SHEET_USER + '" tidak ditemukan.' };
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { success: false, error: 'Tidak ada data akun pada sistem.' };
    }

    const colMap = getUserSheetColMap(sheet);
    const maxCols = Math.max(colMap.totalCols, 9);
    const values = sheet.getRange(2, 1, lastRow - 1, maxCols).getValues();

    // 1. Check if this phone number is already registered
    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      const rowPhone = normalizePhone(row[colMap.phoneCol - 1]);
      if (rowPhone === targetPhone) {
        const existingU = String(row[2] || '');
        if (existingU.toLowerCase() === cleanUser) {
          return { success: true, message: 'Nomor ' + targetPhone + ' sudah terdaftar untuk ' + existingU + '.' };
        } else {
          return { success: false, error: 'Nomor ' + targetPhone + ' sudah digunakan oleh akun lain ("' + existingU + '").' };
        }
      }
    }

    // 2. Find user row(s) to match username
    let userRowData = null;
    let emptyPhoneRowIndex = -1;

    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      const u = String(row[2] || '').trim().toLowerCase();
      if (u === cleanUser) {
        userRowData = row;
        const currentPhone = normalizePhone(row[colMap.phoneCol - 1]);
        if (!currentPhone && emptyPhoneRowIndex === -1) {
          emptyPhoneRowIndex = i + 2;
        }
      }
    }

    if (!userRowData) {
      return { success: false, error: 'Username "' + username + '" tidak ditemukan di database.' };
    }

    // 3. If user has a row with an empty phone cell, populate that cell!
    if (emptyPhoneRowIndex !== -1) {
      const phoneCell = sheet.getRange(emptyPhoneRowIndex, colMap.phoneCol);
      phoneCell.setNumberFormat('@');
      phoneCell.setValue(targetPhone);
      return {
        success: true,
        message: 'Nomor ' + targetPhone + ' berhasil ditautkan ke akun ' + userRowData[2] + '.',
        user: {
          username: String(userRowData[2]),
          name: String(userRowData[1] || userRowData[2]),
          role: String(userRowData[3] || 'User'),
          phone: targetPhone
        }
      };
    }

    // 4. Otherwise, duplicate the user row with the new phone number
    const newRowIdx = lastRow + 1;
    const newRowVals = [
      newRowIdx - 1, // No
      userRowData[1], // Name
      userRowData[2], // Username
      userRowData[3], // Role
      userRowData[4], // Email
      userRowData[5], // Password
      userRowData[6], // Status
      targetPhone     // Phone Number
    ];

    sheet.getRange(newRowIdx, 1, 1, 8).setValues([newRowVals]);
    sheet.getRange(newRowIdx, colMap.phoneCol).setNumberFormat('@');

    const qrPayload = JSON.stringify({ u: String(userRowData[2]), p: String(userRowData[5]), role: String(userRowData[3]) });
    const qrFormula = '=IMAGE("https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=' + encodeURIComponent(qrPayload) + '")';
    sheet.getRange(newRowIdx, colMap.qrCol).setFormula(qrFormula);
    sheet.setRowHeight(newRowIdx, 65);

    sheet.getRange(newRowIdx, 1).setHorizontalAlignment('center');
    sheet.getRange(newRowIdx, 3).setHorizontalAlignment('center');
    sheet.getRange(newRowIdx, 4).setHorizontalAlignment('center').setFontWeight('bold');
    sheet.getRange(newRowIdx, 6).setHorizontalAlignment('center');
    sheet.getRange(newRowIdx, 7).setHorizontalAlignment('center');
    sheet.getRange(newRowIdx, colMap.phoneCol).setHorizontalAlignment('center');
    sheet.getRange(newRowIdx, colMap.qrCol).setHorizontalAlignment('center');

    const role = String(userRowData[3] || '').toLowerCase();
    const uName = String(userRowData[2] || '').toLowerCase();
    if (role === 'iit' || role === 'it' || uName.startsWith('iit')) {
      sheet.hideRows(newRowIdx);
    }

    return {
      success: true,
      message: 'Nomor tambahan ' + targetPhone + ' berhasil didaftarkan untuk ' + userRowData[2] + '.',
      user: {
        username: String(userRowData[2]),
        name: String(userRowData[1] || userRowData[2]),
        role: String(userRowData[3] || 'User'),
        phone: targetPhone
      }
    };
  },

  /**
   * Removes a phone number from the User sheet.
   * If the user has multiple rows with different numbers, deletes the row.
   * If it is the user's only row, clears the phone cell to keep the account alive.
   */
  removePhoneNumber: function(phoneNumber) {
    if (!phoneNumber) {
      return { success: false, error: 'Nomor telepon wajib diisi.' };
    }
    const targetPhone = normalizePhone(phoneNumber);
    if (!targetPhone) {
      return { success: false, error: 'Format nomor telepon tidak valid.' };
    }

    const ss = getSpreadsheetInstance();
    const sheet = ss.getSheetByName(CONFIG.SHEET_USER);
    if (!sheet) {
      return { success: false, error: 'Sheet "' + CONFIG.SHEET_USER + '" tidak ditemukan.' };
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { success: false, error: 'Tidak ada data akun pada sistem.' };
    }

    const colMap = getUserSheetColMap(sheet);
    const maxCols = Math.max(colMap.totalCols, 9);
    const values = sheet.getRange(2, 1, lastRow - 1, maxCols).getValues();

    let matchingRowIdx = -1;
    let matchedUsername = '';

    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      const rowPhone = normalizePhone(row[colMap.phoneCol - 1]);
      if (rowPhone === targetPhone) {
        matchingRowIdx = i + 2;
        matchedUsername = String(row[2] || '').trim().toLowerCase();
        break;
      }
    }

    if (matchingRowIdx === -1) {
      return { success: false, error: 'Nomor ' + targetPhone + ' tidak ditemukan di sheet User.' };
    }

    // Count rows for this user
    let userRowCount = 0;
    for (let i = 0; i < values.length; i++) {
      const u = String(values[i][2] || '').trim().toLowerCase();
      if (u === matchedUsername) {
        userRowCount++;
      }
    }

    if (userRowCount > 1) {
      sheet.deleteRow(matchingRowIdx);
      return {
        success: true,
        message: 'Baris nomor ' + targetPhone + ' milik akun "' + matchedUsername + '" berhasil dihapus.'
      };
    } else {
      sheet.getRange(matchingRowIdx, colMap.phoneCol).setValue('');
      return {
        success: true,
        message: 'Nomor ' + targetPhone + ' telah dicopot dari akun "' + matchedUsername + '" (akun tetap tersimpan).'
      };
    }
  }
};

/**
 * Normalizes phone numbers to standard format (e.g. 628123456789)
 */
function normalizePhone(phone) {
  if (!phone) return '';
  let str = String(phone).trim();
  str = str.split('@')[0].split(':')[0];
  str = str.replace(/[^\d+]/g, '');
  if (str.startsWith('+')) {
    str = str.substring(1);
  }
  if (str.startsWith('0')) {
    str = '62' + str.substring(1);
  } else if (str.startsWith('8')) {
    str = '62' + str;
  }
  return str;
}

/**
 * Helper to dynamically map columns on User sheet
 */
function getUserSheetColMap(sheet) {
  const lastCol = Math.max(sheet.getLastColumn(), 9);
  const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  let phoneCol = 8; // Default column 8
  let qrCol = 9;    // Default column 9

  for (let c = 0; c < headers.length; c++) {
    const h = String(headers[c] || '').toLowerCase().trim();
    if (h.includes('phone') || h.includes('nomor') || h.includes('hp') || h.includes('telepon')) {
      phoneCol = c + 1;
    } else if (h.includes('qr')) {
      qrCol = c + 1;
    }
  }
  return { phoneCol: phoneCol, qrCol: qrCol, totalCols: lastCol };
}

/**
 * Computes SHA-256 hexadecimal hash string
 */
function computeSha256(text) {
  if (!text) return '';
  const rawBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
  let hexString = '';
  for (let i = 0; i < rawBytes.length; i++) {
    let byteVal = rawBytes[i];
    if (byteVal < 0) byteVal += 256;
    let byteHex = byteVal.toString(16);
    if (byteHex.length === 1) byteHex = '0' + byteHex;
    hexString += byteHex;
  }
  return hexString;
}
