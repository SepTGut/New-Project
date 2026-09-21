/**
 * Unified Message Handler for Smart Warehouse & PPO Bot
 * Integrates Warehouse Stock Opname and PPO Field Job Progress Reporting into 1 WhatsApp contact.
 */

const fs = require('fs');
const path = require('path');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

const {
  searchItems,
  getItemByCode,
  verifyLogin,
  updateOpname,
  addMaterial,
  fetchImageBuffer
} = require('../dataService');

const {
  getDaftarGedung,
  ambilTitikLokasi,
  simpanLaporan,
  cariFaq,
  muatSesiAktif,
  simpanSesiAktif,
  FOLDER_FOTO
} = require('../ppoService');

// Map of authenticated user sessions: senderJid -> { username, name, role, loggedInAt }
const sessions = new Map();

// Map of active in-progress PPO report sessions: senderJid -> { step, gedung, ... }
const ppoSessions = muatSesiAktif();

function getSessionsCount() {
  return sessions.size;
}

function getActiveSessions() {
  const list = [];
  for (const [jid, s] of sessions.entries()) {
    list.push({
      phone: jid.split('@')[0],
      username: s.username,
      name: s.name,
      role: s.role,
      loggedInAt: s.loggedInAt
    });
  }
  return list;
}

function formatPhone(jid) {
  if (!jid) return '';
  const num = jid.split('@')[0].split(':')[0];
  return `+${num}`;
}

function waktuSekarang() {
  const sekarang = new Date();
  const tanggal = sekarang.toLocaleDateString('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).replace(/\//g, '-');

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).formatToParts(sekarang);

  const jam = `${parts.find(p => p.type === 'hour').value}:${parts.find(p => p.type === 'minute').value}`;
  return { tanggal, jam };
}

/**
 * Generates formatted list of buildings for PPO report step 1
 */
function teksMenuGedung() {
  const daftar = getDaftarGedung();
  if (daftar.length === 0) {
    return '⚠️ Daftar gedung master belum tersedia. Silakan hubungi admin.';
  }
  const items = daftar.map((g, i) => `${i + 1}. ${g}`).join('\n');
  return `🏢 *PILIH GEDUNG PEKERJAAN:*\n\n${items}\n\n💡 _Ketik nomor gedung yang dikerjakan (contoh: *1* atau *4*), atau ketik *batal* untuk keluar._`;
}

/**
 * Main message router
 */
async function handleMessage(sock, msg) {
  try {
    const from = msg.key.remoteJid;
    if (!from || from.endsWith('@g.us')) {
      // Ignore group chats by default
      return;
    }

    const messageContent = msg.message;
    if (!messageContent) return;

    let text = '';
    const hasImage = !!messageContent.imageMessage;
    if (messageContent.conversation) {
      text = messageContent.conversation;
    } else if (messageContent.extendedTextMessage && messageContent.extendedTextMessage.text) {
      text = messageContent.extendedTextMessage.text;
    } else if (messageContent.imageMessage && messageContent.imageMessage.caption) {
      text = messageContent.imageMessage.caption;
    }

    text = String(text || '').trim();
    if (!text && !hasImage) return;

    const senderName = msg.pushName || 'Rekan Operasional';
    const cleanText = text.replace(/^[!/#]/, '').trim();
    const parts = cleanText.split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const args = parts.slice(1);

    // Active auth session
    const session = sessions.get(from);

    // Active PPO report session
    const ppoSession = ppoSessions.get(from);

    // =========================================================================
    // 0. Global Cancellation for In-Progress PPO Reports
    // =========================================================================
    if (cmd === 'batal') {
      if (ppoSession) {
        ppoSessions.delete(from);
        simpanSesiAktif(ppoSessions);
        await sock.sendMessage(from, {
          text: '❌ *Pengisian laporan dibatalkan.* Anda kembali ke menu utama. Ketik `!menu` untuk melihat perintah.'
        }, { quoted: msg });
      } else {
        await sock.sendMessage(from, {
          text: 'ℹ️ Tidak ada laporan yang sedang aktif diisi. Ketik `!menu` untuk melihat bantuan.'
        }, { quoted: msg });
      }
      return;
    }

    // =========================================================================
    // 1. Help & Unified Main Menu
    // =========================================================================
    if (['menu', 'help', 'bantuan', 'panduan', 'start', 'halo', 'hai'].includes(cmd) && !ppoSession) {
      const userStatus = session ? `🟢 Login sebagai *${session.name}* (${session.role})` : `⚪ Status: *Tamu (Belum Login)*`;
      const menuText =
`📦 *SMART WAREHOUSE & PPO BOT*
━━━━━━━━━━━━━━━━━━━━━━━━━
Halo *${senderName}*!
${userStatus}

Silakan pilih layanan yang ingin Anda gunakan:

📋 *1. LAPORAN PROGRESS PEKERJAAN (PPO):*
• Ketik \`!lapor\` atau \`lapor\` : Mulai isi laporan progress lapangan
• Ketik \`batal\` : Batalkan pengisian laporan kapan saja
• Ketik \`!faq <topik>\` : Tanya jawab SOP teknis & kendala

📦 *2. STOCK OPNAME GUDANG:*
• Ketik nama barang, kode, atau rak langsung (contoh: \`wago\`, \`MCB\`, \`ITEM-1\`, \`san disk 64\`)
• Atau gunakan perintah: \`!cek <kata_kunci>\`
• \`!opname <kode> <qty>\` : Update stok fisik langsung (perlu login)
• \`!tambah <rak>|<kode>|...\` : Tambah material baru (Admin)

🔐 *3. AKUN & SESI:*
• \`!login <user> <pass>\` : Masuk akun petugas opname
• \`!status\` : Cek profil login aktif
• \`!logout\` : Keluar sesi

━━━━━━━━━━━━━━━━━━━━━━━━━
💡 _Ketik perintah atau langsung ketik nama/kode barang yang Anda cari._`;

      await sock.sendMessage(from, { text: menuText }, { quoted: msg });
      return;
    }

    // =========================================================================
    // 2. FAQ Search: !faq <kata_kunci>
    // =========================================================================
    if (cmd === 'faq') {
      const query = args.join(' ').trim();
      if (!query) {
        await sock.sendMessage(from, {
          text: '⚠️ *Format:* `!faq <kata_kunci>`\n_Contoh:_ `!faq lampu` atau `!faq pipa`'
        }, { quoted: msg });
        return;
      }

      const hasil = cariFaq(query);
      if (hasil.length === 0) {
        await sock.sendMessage(from, {
          text: `❌ Tidak ditemukan jawaban FAQ untuk kata kunci *"${query}"*.\nSilakan hubungi PIC / Koordinator PPO.`
        }, { quoted: msg });
        return;
      }

      let faqText = `💡 *HASIL TANYA JAWAB (FAQ) UNTUK "${query}":*\n━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      hasil.forEach((item, idx) => {
        const q = item['Pertanyaan'] || item['pertanyaan'] || item['Question'] || 'Tanya';
        const a = item['Jawaban'] || item['jawaban'] || item['Answer'] || '-';
        faqText += `${idx + 1}. ❓ *${q}*\n   💬 ${a}\n\n`;
      });
      await sock.sendMessage(from, { text: faqText.trim() }, { quoted: msg });
      return;
    }

    // =========================================================================
    // 3. Initiate PPO Progress Report: !lapor / lapor
    // =========================================================================
    if (['lapor', 'progress', 'progres'].includes(cmd) && !ppoSession) {
      ppoSessions.set(from, {
        step: 'pilih_gedung',
        namaPengirim: senderName,
        nomorPengirim: formatPhone(from),
        startedAt: Date.now()
      });
      simpanSesiAktif(ppoSessions);

      await sock.sendMessage(from, {
        text: `Selamat datang di Layanan Lapor Progress PPO 👋\n\n${teksMenuGedung()}`
      }, { quoted: msg });
      return;
    }

    // =========================================================================
    // 4. Interactive PPO Progress Report State Machine (Steps 1 to 9)
    // =========================================================================
    if (ppoSession) {
      // --- STEP 1: Pilih Gedung ---
      if (ppoSession.step === 'pilih_gedung') {
        const daftarGedung = getDaftarGedung();
        const nomor = parseInt(cleanText, 10);

        if (isNaN(nomor) || nomor < 1 || nomor > daftarGedung.length) {
          await sock.sendMessage(from, {
            text: `⚠️ Nomor gedung tidak valid. Pilih 1-${daftarGedung.length}.\n\n${teksMenuGedung()}`
          }, { quoted: msg });
          return;
        }

        const gedungTerpilih = daftarGedung[nomor - 1];
        const { tanggal, jam } = waktuSekarang();

        ppoSessions.set(from, {
          ...ppoSession,
          step: 'pilih_sub_pekerjaan',
          gedung: gedungTerpilih,
          tanggalMulai: tanggal,
          jamSelesai: jam
        });
        simpanSesiAktif(ppoSessions);

        await sock.sendMessage(from, {
          text: `🏢 Gedung: *${gedungTerpilih}*\n📅 Tanggal: *${tanggal}* | Jam: *${jam}* (otomatis)\n\nPilih Sub Pekerjaan:\n1️⃣ Mekanikal\n2️⃣ Elektrikal\n\n_Ketik 1 atau 2:_`
        }, { quoted: msg });
        return;
      }

      // --- STEP 2: Pilih Sub Pekerjaan ---
      if (ppoSession.step === 'pilih_sub_pekerjaan') {
        let sub = '';
        if (cleanText === '1' || cleanText.toLowerCase().includes('mekanikal')) sub = 'Mekanikal';
        else if (cleanText === '2' || cleanText.toLowerCase().includes('elektrikal')) sub = 'Elektrikal';

        if (!sub) {
          await sock.sendMessage(from, {
            text: '⚠️ Mohon ketik *1* (Mekanikal) atau *2* (Elektrikal).'
          }, { quoted: msg });
          return;
        }

        const daftarTitik = ambilTitikLokasi(ppoSession.gedung, sub);
        if (daftarTitik.length === 0) {
          await sock.sendMessage(from, {
            text: `⚠️ Belum ada master Titik Lokasi untuk *${ppoSession.gedung}* (${sub}).\nKetik *menu* atau *batal* untuk memilih ulang.`
          }, { quoted: msg });
          return;
        }

        ppoSessions.set(from, {
          ...ppoSession,
          step: 'pilih_titik_lokasi',
          subPekerjaan: sub,
          daftarTitik
        });
        simpanSesiAktif(ppoSessions);

        const listTitikText = daftarTitik.map((t, idx) => `${idx + 1}. ${t['Titik Lokasi']}`).join('\n');
        await sock.sendMessage(from, {
          text: `Sub Pekerjaan: *${sub}*\n\n📍 *PILIH TITIK LOKASI:*\n${listTitikText}\n\n_Ketik nomor titik lokasi (contoh: 1):_`
        }, { quoted: msg });
        return;
      }

      // --- STEP 3: Pilih Titik Lokasi ---
      if (ppoSession.step === 'pilih_titik_lokasi') {
        const nomor = parseInt(cleanText, 10);
        const daftarTitik = ppoSession.daftarTitik || [];

        if (isNaN(nomor) || nomor < 1 || nomor > daftarTitik.length) {
          await sock.sendMessage(from, {
            text: `⚠️ Nomor tidak valid. Mohon pilih antara 1-${daftarTitik.length}.`
          }, { quoted: msg });
          return;
        }

        const titikLokasi = daftarTitik[nomor - 1]['Titik Lokasi'];
        ppoSessions.set(from, {
          ...ppoSession,
          step: 'input_progres',
          titikLokasi
        });
        simpanSesiAktif(ppoSessions);

        await sock.sendMessage(from, {
          text: `📍 Titik Lokasi: *${titikLokasi}*\n\n📝 *Ketik Deskripsi Progres Pekerjaan:*\nJelaskan apa yang sudah dikerjakan beserta volumenya (titik / meter / persen).\n\n_Contoh:_ "Pemasangan kabel tray selesai 20 meter"`
        }, { quoted: msg });
        return;
      }

      // --- STEP 4: Input Progres ---
      if (ppoSession.step === 'input_progres') {
        if (!text || text.length < 3) {
          await sock.sendMessage(from, {
            text: '⚠️ Deskripsi progres terlalu singkat. Mohon jelaskan pekerjaan yang dilakukan.'
          }, { quoted: msg });
          return;
        }

        ppoSessions.set(from, {
          ...ppoSession,
          step: 'pilih_status',
          progres: text
        });
        simpanSesiAktif(ppoSessions);

        await sock.sendMessage(from, {
          text: `📌 *Pilih Status Pekerjaan:*\n1️⃣ Open (Masih Berlangsung)\n2️⃣ Close (Selesai Tuntas)\n\n_Ketik 1 atau 2:_`
        }, { quoted: msg });
        return;
      }

      // --- STEP 5: Pilih Status ---
      if (ppoSession.step === 'pilih_status') {
        let status = '';
        if (cleanText === '1' || cleanText.toLowerCase() === 'open') status = 'Open';
        else if (cleanText === '2' || cleanText.toLowerCase() === 'close') status = 'Close';

        if (!status) {
          await sock.sendMessage(from, {
            text: '⚠️ Mohon ketik *1* (Open) atau *2* (Close).'
          }, { quoted: msg });
          return;
        }

        ppoSessions.set(from, {
          ...ppoSession,
          step: 'input_kendala',
          status
        });
        simpanSesiAktif(ppoSessions);

        await sock.sendMessage(from, {
          text: `Status: *${status}*\n\n⚠️ *Ketik Kendala di Lapangan:*\n_Ketik "-" atau "tidak ada" jika tidak ada kendala._`
        }, { quoted: msg });
        return;
      }

      // --- STEP 6: Input Kendala ---
      if (ppoSession.step === 'input_kendala') {
        const kendala = (!text || text === '-' || text.toLowerCase().includes('tidak ada')) ? '-' : text;

        ppoSessions.set(from, {
          ...ppoSession,
          step: 'kirim_foto',
          kendala
        });
        simpanSesiAktif(ppoSessions);

        await sock.sendMessage(from, {
          text: `Kendala: *${kendala}*\n\n📸 *Langkah Terakhir: Kirim 1 FOTO Bukti Pekerjaan.*\n_Atau ketik "-" jika ingin menyimpan laporan tanpa foto._`
        }, { quoted: msg });
        return;
      }

      // --- STEP 7: Kirim Foto & Simpan Laporan ---
      if (ppoSession.step === 'kirim_foto') {
        let namaFileFoto = null;

        // Check if user uploaded photo
        if (hasImage) {
          try {
            await sock.sendMessage(from, { text: '⏳ Mengunduh dan memproses foto bukti pekerjaan...' }, { quoted: msg });
            const buffer = await downloadMediaMessage(msg, 'buffer', {});
            if (buffer && buffer.length > 0) {
              const fileName = `foto_${Date.now()}_${from.replace(/[^0-9]/g, '')}.jpg`;
              const filePath = path.join(FOLDER_FOTO, fileName);
              await fs.promises.writeFile(filePath, buffer);
              namaFileFoto = fileName;
            }
          } catch (dlErr) {
            console.warn('[PPO] Failed downloading photo buffer:', dlErr.message);
          }
        }

        await sock.sendMessage(from, { text: '⏳ Menyimpan laporan ke database Excel...' }, { quoted: msg });

        const saveRes = await simpanLaporan({
          pengirim: ppoSession.nomorPengirim || from,
          namaPengirim: ppoSession.namaPengirim || senderName,
          gedung: ppoSession.gedung,
          tanggalMulai: ppoSession.tanggalMulai,
          jamSelesai: ppoSession.jamSelesai,
          subPekerjaan: ppoSession.subPekerjaan,
          titikLokasi: ppoSession.titikLokasi,
          progres: ppoSession.progres,
          status: ppoSession.status,
          kendala: ppoSession.kendala,
          namaFileFoto
        });

        // Clear active report session
        ppoSessions.delete(from);
        simpanSesiAktif(ppoSessions);

        const confirmMsg =
`✅ *LAPORAN PROGRESS BERHASIL TERSIMPAN!*
━━━━━━━━━━━━━━━━━━━━━━━━━
🏢 Gedung       : *${ppoSession.gedung}*
🔧 Sub Pekerjaan: *${ppoSession.subPekerjaan}*
📍 Titik Lokasi : *${ppoSession.titikLokasi}*
📝 Progres      : *${ppoSession.progres}*
📌 Status       : *${ppoSession.status}*
⚠️ Kendala      : *${ppoSession.kendala}*
📷 Foto Bukti   : *${namaFileFoto ? 'Tersimpan & Tersemat' : 'Tanpa Foto'}*
🕒 Waktu Input  : *${saveRes.waktu}*
━━━━━━━━━━━━━━━━━━━━━━━━━
_Laporan otomatis tersimpan ke file Excel dan dicadangkan ke cloud._
Ketik \`!lapor\` untuk mengisi laporan baru lainnya.`;

        await sock.sendMessage(from, { text: confirmMsg }, { quoted: msg });
        return;
      }
    }

    // =========================================================================
    // 5. Authentication: !login
    // =========================================================================
    if (cmd === 'login') {
      if (args.length < 2) {
        await sock.sendMessage(from, {
          text: '⚠️ *Format Login:* `!login <username> <password>`\n_Contoh:_ `!login admin admin123` atau `!login user1 user123`'
        }, { quoted: msg });
        return;
      }

      const [username, password] = args;
      await sock.sendMessage(from, { text: '⏳ Memverifikasi akun Anda ke database...' }, { quoted: msg });

      const authRes = await verifyLogin(username, password);
      if (authRes.success && authRes.user) {
        sessions.set(from, {
          username: authRes.user.username,
          name: authRes.user.name || authRes.user.username,
          role: authRes.user.role || 'User',
          loggedInAt: new Date()
        });

        const successText =
`✅ *LOGIN BERHASIL!*
━━━━━━━━━━━━━━━━━━━━━━━━━
Selamat datang, *${authRes.user.name}*!
• Username: *${authRes.user.username}*
• Hak Akses: *${authRes.user.role}*
• Nomor WA: *${formatPhone(from)}*

Nomor Anda kini telah memiliki otorisasi untuk melakukan *!opname* dan perubahan stok gudang.`;

        await sock.sendMessage(from, { text: successText }, { quoted: msg });
      } else {
        await sock.sendMessage(from, {
          text: `❌ *Login Gagal:* ${authRes.error || 'Username atau password tidak cocok.'}`
        }, { quoted: msg });
      }
      return;
    }

    // =========================================================================
    // 6. Logout: !logout
    // =========================================================================
    if (cmd === 'logout') {
      if (sessions.has(from)) {
        const u = sessions.get(from).name;
        sessions.delete(from);
        await sock.sendMessage(from, {
          text: `🔒 *Sesi Berakhir:* Petugas *${u}* telah keluar. Anda kini berstatus sebagai Tamu.`
        }, { quoted: msg });
      } else {
        await sock.sendMessage(from, {
          text: 'ℹ️ Nomor Anda saat ini memang belum login ke sistem.'
        }, { quoted: msg });
      }
      return;
    }

    // =========================================================================
    // 7. Status: !status / !profil
    // =========================================================================
    if (['status', 'profil', 'profile', 'whoami'].includes(cmd)) {
      if (session) {
        const loginTimeStr = new Date(session.loggedInAt).toLocaleTimeString('id-ID', {
          hour: '2-digit',
          minute: '2-digit'
        });
        const statusText =
`👤 *PROFIL PENGGUNA TERHUBUNG*
━━━━━━━━━━━━━━━━━━━━━━━━━
• Nama Petugas : *${session.name}*
• Username     : *${session.username}*
• Hak Akses    : *${session.role}*
• Nomor WA     : *${formatPhone(from)}*
• Waktu Login  : *${loginTimeStr} WIB*
━━━━━━━━━━━━━━━━━━━━━━━━━
Status: *Aktif & Berwenang mencatat Opname* ✅`;
        await sock.sendMessage(from, { text: statusText }, { quoted: msg });
      } else {
        await sock.sendMessage(from, {
          text: '⚪ *Status: Tamu (Belum Login)*\nAnda dapat mencari stok (`!cek`) dan melapor progress (`!lapor`), namun memerlukan login untuk melakukan perubahan stok gudang.\nKetik `!login <user> <pass>` untuk masuk.'
        }, { quoted: msg });
      }
      return;
    }

    // =========================================================================
    // 8. Stock Check: !cek / !stok / !cari
    // =========================================================================
    if (['cek', 'stok', 'cari', 'item', 'stock'].includes(cmd)) {
      const query = args.join(' ').trim();
      await executeStockSearch(sock, from, msg, query);
      return;
    }

    // =========================================================================
    // 9. Opname Count Update: !opname
    // =========================================================================
    if (cmd === 'opname') {
      if (!session) {
        await sock.sendMessage(from, {
          text: '⚠️ *Akses Ditolak:* Anda harus login terlebih dahulu untuk mencatat hasil opname.\nKetik: `!login <user> <pass>`'
        }, { quoted: msg });
        return;
      }

      if (args.length < 2) {
        await sock.sendMessage(from, {
          text: '⚠️ *Format:* `!opname <kode_material> <jumlah_stok_baru>`\n_Contoh:_ `!opname ITEM-04 150`'
        }, { quoted: msg });
        return;
      }

      const [targetCode, targetQty] = args;
      await sock.sendMessage(from, { text: `⏳ Memperbarui stok *${targetCode}* ke Google Sheets...` }, { quoted: msg });

      const opnameRes = await updateOpname(targetCode, targetQty, session.name);
      if (opnameRes.success) {
        const confirmText =
`✅ *STOCK OPNAME BERHASIL DIPERBARUI!*
━━━━━━━━━━━━━━━━━━━━━━━━━
🏷️ *Kode Material :* \`${opnameRes.kodeMaterial || targetCode}\`
📦 *Nama Barang   :* *${opnameRes.namaBarang || '-'}*
📍 *Lokasi Rak    :* *${opnameRes.lokasiRak || '-'}*
📉 *Stok Sebelum  :* ${opnameRes.oldQty} ${opnameRes.uom || 'PCS'}
📈 *Stok Fisik    :* *${opnameRes.newQty} ${opnameRes.uom || 'PCS'}*
👤 *Dicatat Oleh  :* *${session.name}*
━━━━━━━━━━━━━━━━━━━━━━━━━
_Perubahan langsung aktif di spreadsheet master gudang._`;

        await sock.sendMessage(from, { text: confirmText }, { quoted: msg });
      } else {
        await sock.sendMessage(from, {
          text: `❌ *Gagal Update:* ${opnameRes.error || 'Terjadi kesalahan sistem.'}`
        }, { quoted: msg });
      }
      return;
    }

    // =========================================================================
    // 10. Add Material: !tambah (Admin Only)
    // =========================================================================
    if (cmd === 'tambah') {
      if (!session) {
        await sock.sendMessage(from, {
          text: '⚠️ Anda harus login sebagai *Admin* untuk mendaftarkan barang baru.\nKetik: `!login <user> <pass>`'
        }, { quoted: msg });
        return;
      }

      if (session.role.toLowerCase() !== 'admin' && session.role.toLowerCase() !== 'iit') {
        await sock.sendMessage(from, {
          text: `⛔ Perintah ini memerlukan hak akses *Admin*. Akun Anda saat ini adalah *${session.role}*.`
        }, { quoted: msg });
        return;
      }

      const rawPayload = cleanText.substring(cmd.length).trim();
      const fields = rawPayload.split('|').map(s => s.trim());

      if (fields.length < 3) {
        const helpTambah =
`⚠️ *Format Tambah Material:*
\`!tambah <rak> | <kode> | <nama> | <qty> | <uom> | <deskripsi>\`

_Contoh:_
\`!tambah RAK-B2 | KBL-01 | Kabel Listrik NYM | 50 | MTR | 3x2.5mm Tembaga\``;
        await sock.sendMessage(from, { text: helpTambah }, { quoted: msg });
        return;
      }

      const [rak, kode, nama, qtyStr, uomStr, deskripsiStr] = fields;
      await sock.sendMessage(from, { text: `⏳ Mendaftarkan material baru *${kode}* ke Google Sheets...` }, { quoted: msg });

      const addRes = await addMaterial({
        rak: rak || '-',
        kode: kode,
        nama: nama,
        qty: parseInt(qtyStr || '0', 10) || 0,
        uom: uomStr || 'PCS',
        deskripsi: deskripsiStr || '-'
      }, session.name);

      if (addRes.success) {
        const item = addRes.item || {};
        const successAdd =
`🎉 *MATERIAL BARU BERHASIL DITAMBAHKAN!*
━━━━━━━━━━━━━━━━━━━━━━━━━
No Urut       : *#${item.no || '-'}*
🏷️ Kode Material: \`${item.kodeMaterial || kode}\`
📦 Nama Barang  : *${item.namaBarang || nama}*
📍 Lokasi Rak   : *${item.lokasiRak || rak}*
📊 Qty Awal     : *${item.qty || qtyStr || 0} ${item.uom || uomStr || 'PCS'}*
📄 Deskripsi    : ${item.deskripsi || deskripsiStr || '-'}
👤 Ditambahkan  : *${session.name}*
━━━━━━━━━━━━━━━━━━━━━━━━━
_Data langsung aktif dan siap digunakan untuk opname._`;

        await sock.sendMessage(from, { text: successAdd }, { quoted: msg });
      } else {
        await sock.sendMessage(from, {
          text: `❌ *Gagal Menambah Material:* ${addRes.error || 'Terjadi kesalahan sistem.'}`
        }, { quoted: msg });
      }
      return;
    }

    // Direct search for commands starting with prefix or unrecognized commands
    if (text.startsWith('!') || text.startsWith('/') || text.startsWith('#')) {
      const queryFromPrefix = text.replace(/^[!/#]+/, '').trim();
      if (queryFromPrefix) {
        await executeStockSearch(sock, from, msg, queryFromPrefix);
        return;
      }
      await sock.sendMessage(from, {
        text: `❓ Perintah tidak dikenali.\nKetik \`!menu\` untuk melihat daftar perintah yang tersedia.`
      }, { quoted: msg });
      return;
    }

    // Direct search without prefix for material names, codes, or rack locations
    const plainQuery = text.trim();
    const commonWords = ['ok', 'siap', 'ya', 'y', 'tidak', 't', 'p', 'tes', 'test', 'halo', 'hai', 'hello', 'hi', 'makasih', 'terima kasih', 'thanks', 'thx'];
    if (plainQuery.length >= 2 && !commonWords.includes(plainQuery.toLowerCase())) {
      const matches = await searchItems(plainQuery);
      if (matches && matches.length > 0) {
        await executeStockSearch(sock, from, msg, plainQuery, matches);
        return;
      }
    }

  } catch (err) {
    console.error('Error handling WhatsApp message:', err);
  }
}

/**
 * Helper to perform stock search and reply to user with details or list
 */
async function executeStockSearch(sock, from, msg, query, preloadedResults = null) {
  const cleanQ = String(query || '').trim();
  if (!cleanQ) {
    await sock.sendMessage(from, {
      text: '⚠️ *Format:* Ketik kata kunci langsung atau gunakan `!cek <nama/kode>`\n_Contoh:_ `wago`, `ITEM-1`, `san disk 64`, `MCB ABB`'
    }, { quoted: msg });
    return;
  }

  await sock.sendMessage(from, { text: `🔍 Mencari material *"${cleanQ}"*...` }, { quoted: msg });
  const results = preloadedResults || await searchItems(cleanQ);

  if (!results || results.length === 0) {
    await sock.sendMessage(from, {
      text: `❌ Tidak ditemukan material dengan kata kunci *"${cleanQ}"*.\nPastikan ejaan kode atau nama barang sudah benar, atau ketik \`!menu\` untuk melihat panduan.`
    }, { quoted: msg });
    return;
  }

  const cleanStripped = cleanQ.toLowerCase().replace(/[^a-z0-9]/g, '');
  const exactMatch = results.find(it => {
    const k = String(it.kodeMaterial || '').toLowerCase();
    const n = String(it.no || '');
    return k === cleanQ.toLowerCase() ||
      k.replace(/[^a-z0-9]/g, '') === cleanStripped ||
      n === cleanQ.toLowerCase() ||
      `#${n}` === cleanQ.toLowerCase();
  });

  // Case 1: Exactly 1 item found OR exact match
  if (results.length === 1 || exactMatch) {
    const item = exactMatch || results[0];
    const caption =
`📦 *DETAIL MATERIAL GUDANG*
━━━━━━━━━━━━━━━━━━━━━━━━━
🏷️ *Kode Material :* \`${item.kodeMaterial}\`
📝 *Nama Barang   :* *${item.namaBarang}*
📍 *Lokasi Rak    :* *${item.lokasiRak}*
📊 *Jumlah Stok   :* *${item.qty} ${item.uom}*
📄 *Spesifikasi   :* ${item.deskripsi || '-'}
━━━━━━━━━━━━━━━━━━━━━━━━━
💡 _Untuk update stok fisik, balas:_
\`!opname ${item.kodeMaterial} <jumlah_baru>\``;

    let imageSent = false;
    if (item.fileId || item.linkFoto) {
      try {
        const imgData = await fetchImageBuffer(item.fileId || item.linkFoto);
        if (imgData && imgData.buffer) {
          await sock.sendMessage(from, {
            image: imgData.buffer,
            caption: caption,
            mimetype: imgData.mimeType
          }, { quoted: msg });
          imageSent = true;
        }
      } catch (imgErr) {}
    }

    if (!imageSent) {
      await sock.sendMessage(from, { text: caption }, { quoted: msg });
    }
    return;
  }

  // Case 2: Multiple items found
  const displayCount = Math.min(results.length, 12);
  let listText = `🔍 *Ditemukan ${results.length} Material untuk "${cleanQ}":*\n━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  for (let i = 0; i < displayCount; i++) {
    const it = results[i];
    listText += `${i + 1}. *\`${it.kodeMaterial}\`* — ${it.namaBarang}\n   📍 Rak: *${it.lokasiRak}* | Stok: *${it.qty} ${it.uom}*\n`;
  }

  if (results.length > displayCount) {
    listText += `\n_...dan ${results.length - displayCount} item lainnya._\n`;
  }

  listText += `━━━━━━━━━━━━━━━━━━━━━━━━━\n💡 _Ketik kode material langsung (contoh: \`${results[0].kodeMaterial}\`) untuk melihat detail & foto lengkap._`;
  await sock.sendMessage(from, { text: listText }, { quoted: msg });
}

/**
 * Simulator function for web dashboard playground
 */
async function simulateCommand(phone, messageText) {
  const simulatedMsg = {
    key: { remoteJid: `${phone.replace(/[^0-9]/g, '')}@s.whatsapp.net` },
    pushName: 'Web Simulator User',
    message: { conversation: messageText }
  };

  const capturedReplies = [];
  const fakeSock = {
    sendMessage: async (jid, content) => {
      capturedReplies.push(content);
      return { key: { id: 'SIM_ID' } };
    }
  };

  await handleMessage(fakeSock, simulatedMsg);
  return capturedReplies;
}

module.exports = {
  handleMessage,
  getSessionsCount,
  getActiveSessions,
  simulateCommand
};
