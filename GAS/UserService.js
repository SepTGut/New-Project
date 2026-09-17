/**
 * User & Authentication Management (UserService.js)
 * Manages Admin, User, IIT accounts and auto-generates Login QR formulas.
 */

const UserService = {
  /**
   * Initializes or repairs the User sheet with required roles and QR formulas
   */
  setupUsersSheet: function() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
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

    // 3 Standard Accounts: Admin, User, IIT
    const users = [
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
        name: 'IT Support & Systems',
        username: 'iit_lead',
        role: 'IIT',
        email: 'iit@gudang.local',
        pass: 'iit2026!',
        status: 'Active'
      }
    ];

    for (let i = 0; i < users.length; i++) {
      const u = users[i];
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

      // Auto QR Formula encoding JSON credentials
      const qrPayload = JSON.stringify({ u: u.username, p: u.pass, role: u.role });
      const qrFormula = '=IMAGE("https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=" & ENCODEURL("' + qrPayload.replace(/"/g, '""') + '"))';
      sheet.getRange(rowIdx, 8).setFormula(qrFormula);

      sheet.setRowHeight(rowIdx, 65);
    }

    // Alignments & widths
    sheet.getRange(2, 1, users.length, 1).setHorizontalAlignment('center');
    sheet.getRange(2, 3, users.length, 1).setHorizontalAlignment('center');
    sheet.getRange(2, 4, users.length, 1).setHorizontalAlignment('center').setFontWeight('bold');
    sheet.getRange(2, 5, users.length, 1).setHorizontalAlignment('left');
    sheet.getRange(2, 6, users.length, 1).setHorizontalAlignment('center');
    sheet.getRange(2, 7, users.length, 1).setHorizontalAlignment('center');
    sheet.getRange(2, 8, users.length, 1).setHorizontalAlignment('center');

    sheet.setColumnWidth(1, 45);
    sheet.setColumnWidth(2, 180);
    sheet.setColumnWidth(3, 110);
    sheet.setColumnWidth(4, 90);
    sheet.setColumnWidth(5, 170);
    sheet.setColumnWidth(6, 110);
    sheet.setColumnWidth(7, 85);
    sheet.setColumnWidth(8, 110);

    // Borders
    sheet.getRange(1, 1, users.length + 1, headers.length)
      .setBorder(true, true, true, true, true, true, '#D0D5DD', SpreadsheetApp.BorderStyle.SOLID);

    ss.toast('Sheet ' + CONFIG.SHEET_USER + ' berhasil disiapkan dengan role Admin, User, IIT dan QR Code Login!', 'Sukses', 5);
  },

  /**
   * Retrieves users list formatted for badge card printing
   */
  getAllUsersForPrint: function() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(CONFIG.SHEET_USER);
    if (!sheet) return [];

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return [];

    const data = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
    const users = [];

    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      if (row[2]) { // username
        const payload = JSON.stringify({ u: String(row[2]).trim(), p: String(row[5]).trim(), role: String(row[3]).trim() });
        const qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encodeURIComponent(payload);
        users.push({
          no: row[0],
          name: row[1] || row[2],
          username: row[2],
          role: row[3] || 'User',
          email: row[4],
          status: row[6],
          qrUrl: qrUrl
        });
      }
    }

    return users;
  }
};
