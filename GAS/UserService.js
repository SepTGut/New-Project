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

    const headers = ['No', 'Nama Lengkap', 'Username', 'Role', 'Pseudo Email', 'Password', 'Status', 'QR Code Login'];

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
          status: 'Active'
        },
        {
          no: 2,
          name: 'Warehouse Operator',
          username: 'user1',
          role: 'User',
          email: 'user@gudang.local',
          pass: 'user123',
          status: 'Active'
        },
        {
          no: 3,
          name: 'IT Support & Systems (Hidden)',
          username: 'iit_lead',
          role: 'IIT',
          email: 'iit@gudang.local',
          pass: 'iit2026!',
          status: 'Active'
        }
      ];

      for (let i = 0; i < defaultUsers.length; i++) {
        const u = defaultUsers[i];
        const rowIdx = i + 2;

        sheet.getRange(rowIdx, 1, 1, 7).setValues([[
          u.no,
          u.name,
          u.username,
          u.role,
          u.email,
          u.pass,
          u.status
        ]]);

        const qrPayload = JSON.stringify({ u: u.username, p: u.pass, role: u.role });
        const qrFormula = '=IMAGE("https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=' + encodeURIComponent(qrPayload) + '")';
        sheet.getRange(rowIdx, 8).setFormula(qrFormula);
        sheet.setRowHeight(rowIdx, 65);

        // Hide IIT / IT account row in spreadsheet
        if (u.role.toLowerCase() === 'iit' || u.role.toLowerCase() === 'it' || u.username.toLowerCase().startsWith('iit')) {
          sheet.hideRows(rowIdx);
        }
      }
    } else {
      // Existing accounts: preserve user edits, sync No, QR formula, and hide IT row
      for (let r = 2; r <= lastRow; r++) {
        const rowVals = sheet.getRange(r, 1, 1, 7).getValues()[0];
        const username = String(rowVals[2] || '').trim();
        const role = String(rowVals[3] || 'User').trim();
        const pass = String(rowVals[5] || '').trim();

        if (username) {
          const qrPayload = JSON.stringify({ u: username, p: pass, role: role });
          const qrFormula = '=IMAGE("https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=' + encodeURIComponent(qrPayload) + '")';
          sheet.getRange(r, 8).setFormula(qrFormula);
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
    sheet.getRange(2, 8, totalUsers, 1).setHorizontalAlignment('center');

    sheet.setColumnWidth(1, 45);
    sheet.setColumnWidth(2, 180);
    sheet.setColumnWidth(3, 110);
    sheet.setColumnWidth(4, 90);
    sheet.setColumnWidth(5, 170);
    sheet.setColumnWidth(6, 110);
    sheet.setColumnWidth(7, 85);
    sheet.setColumnWidth(8, 110);

    // Borders
    sheet.getRange(1, 1, totalUsers + 1, headers.length)
      .setBorder(true, true, true, true, true, true, '#D0D5DD', SpreadsheetApp.BorderStyle.SOLID);

    try {
      ss.toast('Sheet ' + CONFIG.SHEET_USER + ' berhasil disinkronisasi (Akun IT disembunyikan).', 'Sukses', 5);
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

    const data = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
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
          qrUrl: qrUrl
        });
      }
    }

    return users;
  },

  /**
   * Verifies username and password against the User sheet
   */
  verifyUser: function(username, password) {
    if (!username || !password) {
      return { success: false, error: 'Username dan password wajib diisi.' };
    }
    const cleanUser = String(username).trim().toLowerCase();
    const cleanPass = String(password).trim();

    const ss = getSpreadsheetInstance();
    const sheet = ss.getSheetByName(CONFIG.SHEET_USER);
    if (!sheet) {
      return { success: false, error: 'Sheet "' + CONFIG.SHEET_USER + '" tidak ditemukan.' };
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { success: false, error: 'Tidak ada data akun pada sistem.' };
    }

    const values = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
    for (let i = 0; i < values.length; i++) {
      const row = values[i];
      const u = String(row[2] || '').trim().toLowerCase();
      const p = String(row[5] || '').trim();
      const status = String(row[6] || 'Active').trim().toLowerCase();

      if (u === cleanUser) {
        if (status === 'inactive' || status === 'nonaktif') {
          return { success: false, error: 'Akun Anda dinonaktifkan.' };
        }
        if (p === cleanPass) {
          return {
            success: true,
            user: {
              no: row[0] || (i + 1),
              name: String(row[1] || row[2]),
              username: String(row[2]),
              role: String(row[3] || 'User'),
              email: String(row[4] || '')
            }
          };
        } else {
          return { success: false, error: 'Password tidak sesuai.' };
        }
      }
    }
    return { success: false, error: 'Username "' + username + '" tidak ditemukan.' };
  }
};
