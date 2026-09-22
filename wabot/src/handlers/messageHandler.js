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
  fetchImageBuffer,
  resolveDrivePhoto
} = require('../dataService');

const {
  scanMaterialCard,
  scanBarcodeOrQr,
  parseDecodedCode
} = require('../barcodeService');

const {
  getDaftarGedung,
  ambilTitikLokasi,
  simpanLaporan,
  cariFaq,
  muatSesiAktif,
  simpanSesiAktif,
  FOLDER_FOTO
} = require('../ppoService');

/**
 * Safely extracts media buffer from real Baileys message or simulator mock
 */
async function extractMediaBuffer(msg) {
  if (msg && msg.__simulatedBuffer) return msg.__simulatedBuffer;
  return await downloadMediaMessage(msg, 'buffer', {});
}

// Map of authenticated user sessions: senderJid -> { username, name, role, loggedInAt }
const sessions = new Map();

// Map of active in-progress PPO report sessions: senderJid -> { step, gedung, ... }
const ppoSessions = muatSesiAktif();

// Map of recent search results: senderJid -> { query, results, withImage, timestamp }
// Stores the last multi-item search list per user for numeric selection (TTL: 5 min)
const searchSessions = new Map();

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
    // 0.1. Numeric Selection from Previous Search Results
    // =========================================================================
    // If the user sends a plain number (optionally followed by G/gambar/foto),
    // and a recent search list is cached for this user, select that item directly.
    if (!ppoSession) {
      const numericMatch = text.trim().match(/^(\d+)(\s+[gG]|\s+(?:gambar|foto))?$/i);
      if (numericMatch) {
        const searchSession = searchSessions.get(from);
        const SEARCH_TTL_MS = 5 * 60 * 1000; // 5 minutes
        if (searchSession && (Date.now() - searchSession.timestamp) < SEARCH_TTL_MS) {
          const idx = parseInt(numericMatch[1], 10) - 1; // 0-based index
          const wantImage = !!(numericMatch[2] && numericMatch[2].trim());
          if (idx >= 0 && idx < searchSession.results.length) {
            const chosen = searchSession.results[idx];
            searchSessions.delete(from); // consume the session after selection
            await executeStockSearch(sock, from, msg, chosen.kodeMaterial, [chosen], wantImage || searchSession.withImage);
            return;
          } else {
            await sock.sendMessage(from, {
              text: `⚠️ Nomor *${numericMatch[1]}* tidak valid. Pilih antara *1* hingga *${searchSession.results.length}*.\n_Atau ketik kata kunci baru untuk mencari ulang._`
            }, { quoted: msg });
            return;
          }
        }
      }
    }


    // Extract quoted message text if user replies to a bot message
    const contextInfo = messageContent.extendedTextMessage && messageContent.extendedTextMessage.contextInfo;
    const quotedMsg = contextInfo && contextInfo.quotedMessage;
    let quotedText = '';
    if (quotedMsg) {
      quotedText = quotedMsg.conversation ||
                   (quotedMsg.extendedTextMessage && quotedMsg.extendedTextMessage.text) ||
                   (quotedMsg.imageMessage && quotedMsg.imageMessage.caption) || '';
    }

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
    // 0.4. Public Web URL Command: !link / link / url / alamat / web
    // Fetches the live Cloudflare Tunnel URL from the cloudflared metrics API
    // =========================================================================
    if (['link', 'url', 'alamat', 'web'].includes(cmd) && !ppoSession) {
      try {
        // cloudflared exposes live tunnel info at http://cloudflared:2000/quicktunnel
        const cfRes = await axios.get('http://cloudflared:2000/quicktunnel', { timeout: 4000 });
        const hostname = cfRes.data && cfRes.data.hostname;
        if (hostname) {
          await sock.sendMessage(from, {
            text: `🌐 *Link Akses Web Gudang (Internet):*\n\nhttps://${hostname}\n\n📱 _Bisa dibuka dari HP/laptop manapun tanpa VPN._\n⚠️ _URL berubah setiap kali server di-restart._`
          }, { quoted: msg });
        } else {
          await sock.sendMessage(from, {
            text: '⏳ *Tunnel sedang memuat...*\nCoba lagi dalam 30 detik setelah server baru menyala.'
          }, { quoted: msg });
        }
      } catch (e) {
        await sock.sendMessage(from, {
          text: `⚠️ *Tunnel tidak aktif atau belum siap.*\n\nAkses lokal:\n• http://localhost:3000 (Web)\n• http://localhost:3001/dashboard (Bot)\n\n_Error: ${e.message}_`
        }, { quoted: msg });
      }
      return;
    }

    // =========================================================================
    // 0.5. Dedicated Image Request Trigger: G / !g / !gambar / !foto (Text Only)
    // (Only includes photo when user explicitly requests with 'G')
    // =========================================================================
    if (!hasImage && ['g', 'gambar', 'foto'].includes(cmd) && !ppoSession) {
      const rawArg = args.join(' ').trim();
      if (rawArg) {
        await executeStockSearch(sock, from, msg, rawArg, null, true);
        return;
      }

      // If user replied 'G' to a material detail message
      if (quotedText) {
        const matchCode = quotedText.match(/Kode Material\s*:\s*[`*]?([A-Za-z0-9-_]+)[`*]?/i) ||
                          quotedText.match(/`([A-Za-z0-9-_]+)`/);
        if (matchCode && matchCode[1]) {
          await executeStockSearch(sock, from, msg, matchCode[1], null, true);
          return;
        }
      }

      await sock.sendMessage(from, {
        text: '📸 *Lihat Foto Material (G):*\nKetik `G <kode_material>` atau balas pesan barang dengan huruf `G`.\n_Contoh:_ `G ITEM-1`, `G wago`, atau `ITEM-1 G`'
      }, { quoted: msg });
      return;
    }

    // =========================================================================
    // 0.6. Card Barcode / QR Code Image Auto-Scanner & OCR
    // (Triggered whenever user uploads a photo of a card, barcode, or QR code)
    // =========================================================================
    if (hasImage && !ppoSession && !['lapor', 'login', 'opname', 'tambah'].includes(cmd)) {
      try {
        await sock.sendMessage(from, {
          text: '📷 *Memproses foto...*\nSedang memindai Barcode / QR Code / Teks kartu material...'
        }, { quoted: msg });

        const buffer = await extractMediaBuffer(msg);
        if (buffer && buffer.length > 0) {
          const scanResult = await scanMaterialCard(buffer);

          if (scanResult.success && scanResult.text) {
            const parsed = parseDecodedCode(scanResult.text);

            // Case A: User QR Login Badge (Printed from PrintUserQR)
            if (parsed.type === 'user') {
              if (parsed.username && parsed.password) {
                await sock.sendMessage(from, {
                  text: `🪪 *QR CODE LOGIN PENGGUNA TERDETEKSI*\n• Username: *${parsed.username}*\n• Role: *${parsed.role}*\n⏳ Memproses login otomatis...`
                }, { quoted: msg });

                const loginResult = await verifyLogin(parsed.username, parsed.password);
                if (loginResult.success) {
                  sessions.set(from, {
                    username: parsed.username,
                    name: loginResult.name || parsed.username,
                    role: loginResult.role || parsed.role || 'Staff',
                    loggedInAt: Date.now()
                  });
                  await sock.sendMessage(from, {
                    text: `✅ *Login Berhasil!*\nSelamat datang, *${loginResult.name || parsed.username}* (*${loginResult.role || parsed.role}*).\nSesi Anda aktif.`
                  }, { quoted: msg });
                } else {
                  await sock.sendMessage(from, {
                    text: `❌ *Login Gagal:* ${loginResult.error || 'Kredensial pada QR code tidak valid.'}`
                  }, { quoted: msg });
                }
                return;
              }
            }

            // Case B: Material Barcode / QR Code or OCR Text (Printed from Material Card)
            const targetCode = parsed.value || scanResult.text;
            const captionFlag = cleanText.toLowerCase();
            const withImage = /^[gG]$|(\b[gG]\b)|foto|gambar/i.test(captionFlag);

            const modeLabel = scanResult.isOcr
              ? `_(Mode: OCR Teks Kartu - ${scanResult.format})_`
              : `_(Tipe: ${scanResult.format})_`;

            await sock.sendMessage(from, {
              text: `✅ *${scanResult.isOcr ? 'Teks Kartu' : 'Barcode/QR'} Berhasil Terdeteksi!*\n🏷️ *Kode Terbaca:* \`${targetCode}\` ${modeLabel}\n_Mengambil data material..._`
            }, { quoted: msg });

            await executeStockSearch(sock, from, msg, targetCode, null, withImage);
            return;
          } else {
            // Neither barcode nor readable card text detected in the uploaded photo
            await sock.sendMessage(from, {
              text: `⚠️ *Barcode, QR Code, atau Teks Kartu Tidak Terdeteksi*\n\n💡 *Tips Pengambilan Foto:*
1. Pastikan barcode atau kode pada kartu tampak jelas & fokus (tidak blur).
2. Pastikan pencahayaan cukup terang dan kartu tidak terpotong.
3. Arahkan kamera lebih dekat ke area barcode/kode barang.

_Atau Anda bisa langsung mengetik kode barang (contoh: \`ITEM-1\`, \`wago\`)._`
            }, { quoted: msg });
            return;
          }
        }
      } catch (scanErr) {
        console.error('[BarcodeScanner] Gagal memproses gambar:', scanErr);
        await sock.sendMessage(from, {
          text: `⚠️ Terjadi kendala saat membaca foto: ${scanErr.message}\nSilakan coba kirim ulang atau ketik kode barang secara manual.`
        }, { quoted: msg });
        return;
      }
    }

    // =========================================================================
    // 1. Help, Greetings & Unified Quick-Start Tutorial
    // =========================================================================
    if (['panduan', 'tutorial', 'cara'].includes(cmd) && !ppoSession) {
      const panduanText =
`📖 *PANDUAN LENGKAP PENGGUNAAN BOT*
━━━━━━━━━━━━━━━━━━━━

Selamat datang! Berikut panduan praktis menggunakan asisten bot:

🔹 *1. CARA MENCARI BARANG GUDANG*
Tidak perlu menghafal kode perintah rumit:
1. *Pindai Kartu Material (Cepat):*
   Cukup foto kartu material atau barcode rak & kirim langsung ke chat ini! Bot otomatis membaca barcode/QR code dan menampilkan datanya.
2. *Pencarian Teks Cepat:*
   Ketik langsung nama atau kode item ke chat (misal: \`ITEM-1\` atau \`wago\`) untuk detail teks cepat tanpa foto.
3. *Foto Google Drive:*
   Tambahkan huruf *G* (misal: \`G ITEM-1\`, \`ITEM-1 G\`, atau saat kirim foto kartu sertakan caption \`G\`) untuk melihat foto barang.
4. Atau balas *(reply)* pesan detail barang dengan huruf *G*.


🔹 *2. CARA UPDATE STOK (STOCK OPNAME)*
Hanya petugas terdaftar yang dapat mengubah stok master:
1. Masuk ke akun Anda:
   \`!login user1 user123\`  (atau \`admin admin123\`)
2. Cari barang yang ingin dihitung:
   \`!cek ITEM-1\`
3. Masukkan jumlah stok fisik hasil hitungan:
   \`!opname ITEM-1 45\`
4. Stok di Google Spreadsheet otomatis terupdate secara instan!


🔹 *3. CARA LAPOR PROGRESS PEKERJAAN (PPO)*
Formulir interaktif terpandu 7 langkah:
1. Ketik: \`!lapor\`
2. Bot menampilkan daftar gedung: balas dengan nomor pilihan (misal: \`1\`).
3. Pilih sub pekerjaan: ketik \`1\` (Mekanikal) atau \`2\` (Elektrikal).
4. Pilih nomor titik lokasi kerja dari daftar.
5. Tulis uraian progres pekerjaan yang sudah dikerjakan.
6. Pilih status: \`1\` (Open/Sedang Berjalan) atau \`2\` (Close/Selesai).
7. Tulis kendala di lapangan (atau ketik \`-\` jika lancar).
8. Kirim 1 foto dokumentasi pekerjaan (atau ketik \`-\` jika tanpa foto).
9. Laporan otomatis tersimpan rapi ke file Excel & sinkron ke cloud!


🔹 *4. TANYA JAWAB & STATUS MATERIAL (FAQ)*
Butuh info SOP atau status pengadaan material?
• Ketik: \`!faq <topik>\`
  _Contoh 1:_ \`!faq lapor\` ➔ SOP pelaporan & foto
  _Contoh 2:_ \`!faq 4 way dos\` ➔ Cek PO & status kedatangan material


🔹 *5. TIPS PENTING*
• Ketik \`batal\` kapan saja jika ingin membatalkan pengisian laporan.
• Ketik \`!status\` untuk memeriksa profil & hak akses akun Anda.
• Ketik \`!menu\` untuk melihat ringkasan perintah cepat.
━━━━━━━━━━━━━━━━━━━━`;

      await sock.sendMessage(from, { text: panduanText }, { quoted: msg });
      return;
    }

    if (['menu', 'help', 'bantuan', 'readme', 'start', 'mulai', 'halo', 'hai', 'hey', 'helo', 'hello', 'hi', 'p', 'info', 'petunjuk'].includes(cmd) && !ppoSession) {
      const subMenu = args[0] ? args[0].toLowerCase() : '';

      // Sub-menu Gudang
      if (subMenu === 'gudang' || subMenu === 'stock' || subMenu === 'opname') {
        const menuGudangText =
`📦 *MODUL GUDANG & STOCK OPNAME*
━━━━━━━━━━━━━━━━━━━━

• *Cari Cepat:*
  Ketik langsung: nama barang / kode / rak
  _Contoh:_ \`wago\`, \`ITEM-1\`, \`RE02.1\`

• *Detail Barang:*
  \`!cek <kata_kunci>\`
  _Contoh:_ \`!cek kabel NYM\`

• *Update Stok Fisik:*
  \`!opname <kode_material> <jumlah_baru>\`
  _Contoh:_ \`!opname ITEM-1 50\` *(Perlu login)*

• *Tambah Barang Baru (Admin):*
  \`!tambah <rak> | <kode> | <nama> | <qty> | <uom> | <deskripsi>\`

• *Akun Petugas:*
  \`!login <user> <pass>\`  |  \`!status\`  |  \`!logout\`

━━━━━━━━━━━━━━━━━━━━
💡 _Ketik \`!menu\` untuk melihat semua modul._`;
        await sock.sendMessage(from, { text: menuGudangText }, { quoted: msg });
        return;
      }

      // Sub-menu PPO
      if (subMenu === 'ppo' || subMenu === 'lapor' || subMenu === 'progres' || subMenu === 'progress') {
        const menuPpoText =
`📋 *MODUL PROGRESS PEKERJAAN (PPO)*
━━━━━━━━━━━━━━━━━━━━

• *Isi Laporan Baru:*
  \`!lapor\`
  _Memulai formulir terpandu (Gedung ➔ Sub Pekerjaan ➔ Titik Lokasi ➔ Progres ➔ Foto)._

• *Batalkan Pengisian:*
  \`batal\`
  _Bisa diketik kapan saja saat mengisi laporan._

• *Cek SOP & Status Material:*
  \`!faq <kata_kunci>\`
  _Contoh:_ \`!faq pipa\`, \`!faq lampu\`, \`!faq 4 way dos\`

━━━━━━━━━━━━━━━━━━━━
💡 _Ketik \`!menu\` untuk melihat semua modul._`;
        await sock.sendMessage(from, { text: menuPpoText }, { quoted: msg });
        return;
      }

      // Main Clean Overview Menu
      const userStatus = session ? `🟢 Petugas: *${session.name}* (${session.role})` : `⚪ Status: *Tamu (Belum Login)*`;
      const cleanMenuText =
`🤖 *MENU OPERASIONAL BOT*
Gudang & Pelaporan Lapangan (PPO)

Halo *${senderName}*!
${userStatus}

━━━━━━━━━━━━━━━━━━━━

📦 *PENCARIAN CEPAT (TANPA PERINTAH)*
Cari barang langsung tanpa tanda seru:
➔ Cukup ketik: nama barang / kode / rak
_Contoh:_ \`wago\`, \`ITEM-1\`, \`san disk\`, \`RE02.1\`

━━━━━━━━━━━━━━━━━━━━

🏢 *STOCK OPNAME GUDANG*
• \`!cek <kata_kunci>\`
  ➔ Cek detail spesifikasi & stok (Teks cepat)
  _Contoh:_ \`!cek MCB ABB\`, \`wago\`, \`ITEM-1\`

• \`G <kode>\` atau \`!g <kode>\`
  ➔ Tampilkan kartu detail beserta FOTO Google Drive
  _Contoh:_ \`G ITEM-1\`, \`ITEM-1 G\`, \`!g wago\`

• \`!opname <kode> <jumlah>\`
  ➔ Update jumlah fisik stok gudang
  _Contoh:_ \`!opname ITEM-1 50\` *(Perlu Login)*

• \`!tambah <rak> | <kode> | <nama> | <qty> | <uom> | <ket>\`
  ➔ Daftarkan material baru *(Khusus Admin)*

━━━━━━━━━━━━━━━━━━━━

📋 *PROGRESS PEKERJAAN (PPO)*
• \`!lapor\`
  ➔ Mulai formulir laporan terpandu 7 langkah
  _(Gedung ➔ Sub Pekerjaan ➔ Titik Lokasi ➔ Progres ➔ Foto)_

• \`batal\`
  ➔ Batalkan pengisian laporan kapan saja

• \`!faq <topik>\`
  ➔ Cek SOP kerja & status pengadaan material
  _Contoh:_ \`!faq pipa\`, \`!faq lampu\`, \`!faq 4 way dos\`

━━━━━━━━━━━━━━━━━━━━

🔐 *AKUN PETUGAS*
• \`!login <user> <pass>\` ➔ Masuk akun petugas
• \`!status\` ➔ Periksa profil & hak akses aktif
• \`!logout\` ➔ Keluar sesi

━━━━━━━━━━━━━━━━━━━━

🌐 *AKSES INTERNET*
• \`link\` atau \`url\`
  ➔ Dapatkan URL publik untuk buka Web Gudang dari internet / HP luar jaringan

━━━━━━━━━━━━━━━━━━━━
💡 _Ketik *!panduan* untuk tutorial lengkap langkah demi langkah._
💡 _Ketik *!menu gudang* atau *!menu ppo* untuk tampilan khusus._`;

      await sock.sendMessage(from, { text: cleanMenuText }, { quoted: msg });
      return;
    }

    if ((['makasih', 'thanks', 'thx', 'tq'].includes(cmd) || cleanText.toLowerCase().startsWith('terima kasih')) && !ppoSession) {
      await sock.sendMessage(from, {
        text: `Sama-sama *${senderName}*! Senang bisa membantu. Ketik \`!menu\` jika membutuhkan bantuan lain. 😊`
      }, { quoted: msg });
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
      let query = args.join(' ').trim();
      let withImg = false;
      if (/^[gG]\s+/i.test(query)) {
        withImg = true;
        query = query.replace(/^[gG]\s+/i, '').trim();
      } else if (/\s+[gG]$/i.test(query)) {
        withImg = true;
        query = query.replace(/\s+[gG]$/i, '').trim();
      } else if (/^(gambar|foto)\s+/i.test(query)) {
        withImg = true;
        query = query.replace(/^(gambar|foto)\s+/i, '').trim();
      } else if (/\s+(gambar|foto)$/i.test(query)) {
        withImg = true;
        query = query.replace(/\s+(gambar|foto)$/i, '').trim();
      }
      await executeStockSearch(sock, from, msg, query, null, withImg);
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
    let plainQuery = text.trim();
    let directImage = false;

    if (/^[gG]\s+/i.test(plainQuery)) {
      directImage = true;
      plainQuery = plainQuery.replace(/^[gG]\s+/i, '').trim();
    } else if (/\s+[gG]$/i.test(plainQuery)) {
      directImage = true;
      plainQuery = plainQuery.replace(/\s+[gG]$/i, '').trim();
    } else if (/^(gambar|foto)\s+/i.test(plainQuery)) {
      directImage = true;
      plainQuery = plainQuery.replace(/^(gambar|foto)\s+/i, '').trim();
    } else if (/\s+(gambar|foto)$/i.test(plainQuery)) {
      directImage = true;
      plainQuery = plainQuery.replace(/\s+(gambar|foto)$/i, '').trim();
    }

    const commonWords = ['ok', 'siap', 'ya', 'y', 'tidak', 't', 'p', 'tes', 'test', 'halo', 'hai', 'hello', 'hi', 'makasih', 'terima kasih', 'thanks', 'thx'];
    if (plainQuery.length >= 2 && !commonWords.includes(plainQuery.toLowerCase())) {
      const matches = await searchItems(plainQuery);
      if (matches && matches.length > 0) {
        await executeStockSearch(sock, from, msg, plainQuery, matches, directImage);
        return;
      }
    }

  } catch (err) {
    console.error('Error handling WhatsApp message:', err);
  }
}

/**
 * Helper to perform stock search and reply to user with details or list
 * @param {Object} sock
 * @param {string} from
 * @param {Object} msg
 * @param {string} query
 * @param {Array|null} preloadedResults
 * @param {boolean} withImage - If true, fetches and sends image from Google Drive
 */
async function executeStockSearch(sock, from, msg, query, preloadedResults = null, withImage = false) {
  let targetQuery = String(query || '').trim();
  let needImage = Boolean(withImage);

  // Auto-detect G / gambar / foto in query:
  // Starts with "G " or "g " (e.g. "G ITEM-1", "g wago", "G 10")
  if (/^[gG]\s+/i.test(targetQuery)) {
    needImage = true;
    targetQuery = targetQuery.replace(/^[gG]\s+/i, '').trim();
  }
  // Ends with " G" or " g" (e.g. "ITEM-1 G", "wago g")
  else if (/\s+[gG]$/i.test(targetQuery)) {
    needImage = true;
    targetQuery = targetQuery.replace(/\s+[gG]$/i, '').trim();
  }
  // Starts with "gambar " or "foto "
  else if (/^(gambar|foto)\s+/i.test(targetQuery)) {
    needImage = true;
    targetQuery = targetQuery.replace(/^(gambar|foto)\s+/i, '').trim();
  }
  // Ends with " gambar" or " foto"
  else if (/\s+(gambar|foto)$/i.test(targetQuery)) {
    needImage = true;
    targetQuery = targetQuery.replace(/\s+(gambar|foto)$/i, '').trim();
  }

  const cleanQ = targetQuery;
  if (!cleanQ) {
    await sock.sendMessage(from, {
      text: '⚠️ *Format:* Ketik kata kunci langsung atau gunakan `!cek <nama/kode>`\n_Untuk foto:_ ketik `G <kode>` (contoh: `G ITEM-1`, `ITEM-1 G`)'
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

    // If user did NOT say G: send quick clean text without downloading image
    if (!needImage) {
      const textOnlyCaption =
`📦 *DETAIL MATERIAL GUDANG*
━━━━━━━━━━━━━━━━━━━━━━━━━
🏷️ *Kode Material :* \`${item.kodeMaterial}\`
📝 *Nama Barang   :* *${item.namaBarang}*
📍 *Lokasi Rak    :* *${item.lokasiRak}*
📊 *Jumlah Stok   :* *${item.qty} ${item.uom}*
📄 *Spesifikasi   :* ${item.deskripsi || '-'}
━━━━━━━━━━━━━━━━━━━━━━━━━
🖼️ _Ketik *G ${item.kodeMaterial}* untuk melihat foto barang_
💡 _Untuk update stok fisik, balas:_
\`!opname ${item.kodeMaterial} <jumlah_baru>\``;

      await sock.sendMessage(from, { text: textOnlyCaption }, { quoted: msg });
      return;
    }

    // If user said G: fetch image from GDrive and send with caption
    const imageCaption =
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
    let targetFileId = item.fileId;
    let targetLink = item.imageUrl || item.linkFoto;

    if (!targetFileId) {
      const resolved = resolveDrivePhoto(item.no, item.kodeMaterial, item.namaBarang);
      if (resolved) {
        targetFileId = resolved.fileId;
        targetLink = resolved.url;
      }
    }

    if (targetFileId || targetLink) {
      try {
        const imgData = await fetchImageBuffer(targetFileId || targetLink);
        if (imgData && imgData.buffer) {
          await sock.sendMessage(from, {
            image: imgData.buffer,
            caption: imageCaption,
            mimetype: imgData.mimeType || 'image/jpeg'
          }, { quoted: msg });
          imageSent = true;
        }
      } catch (imgErr) {
        console.warn(`[StockSearch] Gagal mengunduh foto Drive untuk ${item.kodeMaterial}:`, imgErr.message);
      }
    }

    if (!imageSent) {
      await sock.sendMessage(from, {
        text: `${imageCaption}\n\nℹ️ _Foto material ini belum tersedia di Google Drive._`
      }, { quoted: msg });
    }
    return;
  }

  // Case 2: Multiple items found — cache results for numeric pick
  const displayCount = Math.min(results.length, 12);
  // Store results so the user can pick by typing the list number (TTL: 5 min)
  searchSessions.set(from, {
    query: cleanQ,
    results: results.slice(0, displayCount),
    withImage: needImage,
    timestamp: Date.now()
  });
  let listText = `🔍 *Ditemukan ${results.length} Material untuk "${cleanQ}":*\n━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  for (let i = 0; i < displayCount; i++) {
    const it = results[i];
    listText += `${i + 1}. *\`${it.kodeMaterial}\`* — ${it.namaBarang}\n   📍 Rak: *${it.lokasiRak}* | Stok: *${it.qty} ${it.uom}*\n`;
  }

  if (results.length > displayCount) {
    listText += `\n_...dan ${results.length - displayCount} item lainnya._\n`;
  }

  listText += `━━━━━━━━━━━━━━━━━━━━━━━━━\n💡 _Ketik *nomor* (misal: *1*) untuk melihat detail item tersebut._\n🖼️ _Tambah *G* setelah nomor (misal: *1 G*) untuk langsung melihat foto._`;
  await sock.sendMessage(from, { text: listText }, { quoted: msg });
}

/**
 * Simulator function for web dashboard playground
 */
async function simulateCommand(phone, messageText, imageBuffer = null) {
  const simulatedMsg = {
    key: { remoteJid: `${phone.replace(/[^0-9]/g, '')}@s.whatsapp.net` },
    pushName: 'Web Simulator User',
    message: imageBuffer ? {
      imageMessage: {
        caption: messageText || '',
        mimetype: 'image/jpeg'
      }
    } : {
      conversation: messageText
    },
    __simulatedBuffer: imageBuffer
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
