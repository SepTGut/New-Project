/**
 * WhatsApp Bot Web Dashboard & Status Server (server.js)
 * Serves live QR code pairing page, status telemetry, PPO progress report downloads,
 * recent reports viewer, and interactive command simulator.
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { startBot, botState, resetAuthSession } = require('./bot');
const { getSessionsCount, getActiveSessions, simulateCommand } = require('./handlers/messageHandler');
const { getRecentReports, LAPORAN_FILE_PATH } = require('./ppoService');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * Status API Endpoint
 */
app.get('/api/status', (req, res) => {
  const uptimeSeconds = Math.floor((Date.now() - botState.startedAt.getTime()) / 1000);
  res.json({
    status: botState.status,
    qrDataUrl: botState.qrDataUrl,
    connectedUser: botState.connectedUser ? {
      id: botState.connectedUser.id ? botState.connectedUser.id.split(':')[0] : '',
      name: botState.connectedUser.name || 'Warehouse & PPO Bot'
    } : null,
    uptimeSeconds,
    activeSessionsCount: getSessionsCount(),
    activeSessions: getActiveSessions(),
    lastDisconnect: botState.lastDisconnectReason
  });
});

/**
 * Recent PPO Reports Endpoint
 */
app.get('/api/reports/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 10;
    const reports = await getRecentReports(limit);
    res.json({ success: true, count: reports.length, reports });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Download Laporan Progress Excel (.xlsx)
 */
app.get('/api/reports/download', (req, res) => {
  if (fs.existsSync(LAPORAN_FILE_PATH)) {
    res.download(LAPORAN_FILE_PATH, 'laporan-progress.xlsx');
  } else {
    res.status(404).send('File laporan belum tersedia.');
  }
});

/**
 * Prometheus Metrics Endpoint
 */
app.get('/metrics', (req, res) => {
  const uptime = Math.floor((Date.now() - botState.startedAt.getTime()) / 1000);
  const statusVal = botState.status === 'connected' ? 1 : 0;
  const metrics = `
# HELP wabot_uptime_seconds Bot uptime in seconds
# TYPE wabot_uptime_seconds gauge
wabot_uptime_seconds ${uptime}

# HELP wabot_connected Connection status (1=connected, 0=disconnected)
# TYPE wabot_connected gauge
wabot_connected ${statusVal}

# HELP wabot_active_sessions Active authenticated user sessions
# TYPE wabot_active_sessions gauge
wabot_active_sessions ${getSessionsCount()}
`.trim();

  res.setHeader('Content-Type', 'text/plain; version=0.0.4');
  res.send(metrics);
});

/**
 * Reset Auth Session API Endpoint
 */
app.post('/api/reset-session', async (req, res) => {
  const result = await resetAuthSession();
  res.json(result);
});

/**
 * Interactive Command Simulator API Endpoint
 */
app.post('/api/simulate', async (req, res) => {
  try {
    const { phone = '6281200001111', message = '!menu' } = req.body;
    const replies = await simulateCommand(phone, message);
    res.json({ success: true, replies });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Modern Dashboard Web Page (serves '/' and '/dashboard')
 */
app.get(['/', '/dashboard'], (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WhatsApp Bot Dashboard - Smart Warehouse & PPO</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #0F172A;
      --card-bg: #1E293B;
      --card-border: #334155;
      --accent: #25D366;
      --accent-hover: #1EBE5D;
      --primary: #3B82F6;
      --text-main: #F8FAFC;
      --text-muted: #94A3B8;
      --status-green: #10B981;
      --status-yellow: #F59E0B;
      --status-red: #EF4444;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; }
    body { background-color: var(--bg); color: var(--text-main); min-height: 100vh; padding: 24px 16px; }
    .container { max-width: 1140px; margin: 0 auto; }
    
    header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 1px solid var(--card-border); flex-wrap: wrap; gap: 16px; }
    .logo-area { display: flex; align-items: center; gap: 12px; }
    .logo-badge { width: 46px; height: 46px; background: #25D36622; border: 1px solid #25D36655; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 24px; }
    .header-titles h1 { font-size: 20px; font-weight: 700; color: #FFFFFF; }
    .header-titles p { font-size: 13px; color: var(--text-muted); }
    
    .status-badge { display: inline-flex; align-items: center; gap: 8px; padding: 8px 16px; border-radius: 9999px; font-size: 13px; font-weight: 600; }
    .status-badge.connected { background: #10B98122; border: 1px solid #10B98155; color: #34D399; }
    .status-badge.qr_ready { background: #F59E0B22; border: 1px solid #F59E0B55; color: #FBBF24; }
    .status-badge.connecting { background: #3B82F622; border: 1px solid #3B82F655; color: #60A5FA; }
    .status-badge.disconnected { background: #EF444422; border: 1px solid #EF444455; color: #F87171; }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; background: currentColor; }

    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 24px; margin-bottom: 24px; }
    .card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 16px; padding: 24px; }
    .card-title { font-size: 16px; font-weight: 600; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; }
    
    .qr-box { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 330px; background: #0F172A88; border-radius: 12px; padding: 20px; border: 1px dashed var(--card-border); text-align: center; }
    .qr-img { width: 270px; height: 270px; border-radius: 12px; background: white; padding: 8px; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); }
    .qr-steps { margin-top: 16px; font-size: 13px; color: var(--text-muted); text-align: left; line-height: 1.6; }
    .qr-steps li { margin-left: 18px; margin-bottom: 4px; }

    .stat-list { display: flex; flex-direction: column; gap: 10px; }
    .stat-item { display: flex; justify-content: space-between; padding: 10px 12px; background: #0F172A66; border-radius: 8px; font-size: 13px; }
    .stat-label { color: var(--text-muted); }
    .stat-val { font-weight: 600; color: #F8FAFC; }

    .sim-form { display: flex; flex-direction: column; gap: 10px; }
    .sim-input { background: #0F172A; border: 1px solid var(--card-border); color: #F8FAFC; padding: 10px 14px; border-radius: 8px; font-size: 14px; outline: none; }
    .sim-input:focus { border-color: var(--accent); }
    .sim-btn { background: var(--accent); color: #064E3B; border: none; padding: 10px 16px; border-radius: 8px; font-weight: 600; font-size: 14px; cursor: pointer; transition: all 0.2s; }
    .sim-btn:hover { background: var(--accent-hover); }
    .sim-btn:disabled { opacity: 0.5; cursor: not-allowed; }
    .sim-output { background: #0F172A; border: 1px solid var(--card-border); border-radius: 8px; padding: 14px; font-size: 13px; color: #E2E8F0; white-space: pre-wrap; max-height: 220px; overflow-y: auto; font-family: monospace; }

    .quick-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 4px; }
    .chip { background: #334155; color: #E2E8F0; padding: 4px 10px; border-radius: 9999px; font-size: 11px; cursor: pointer; border: 1px solid #475569; }
    .chip:hover { background: #475569; color: #FFFFFF; }
    
    .btn-danger { background: #EF444422; color: #F87171; border: 1px solid #EF444444; padding: 8px 14px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; }
    .btn-danger:hover { background: #EF444433; }
    
    .btn-download { background: #10B98122; color: #34D399; border: 1px solid #10B98144; padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; transition: all 0.2s; }
    .btn-download:hover { background: #10B98133; color: #6EE7B7; }

    /* Reports Table */
    .table-container { overflow-x: auto; background: #0F172A66; border-radius: 12px; border: 1px solid var(--card-border); }
    table { width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; }
    th { background: #1E293B; color: var(--text-muted); font-weight: 600; padding: 12px 14px; border-bottom: 1px solid var(--card-border); }
    td { padding: 12px 14px; border-bottom: 1px solid #33415544; color: #E2E8F0; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: #1E293B55; }
    .badge-status { display: inline-block; padding: 3px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; }
    .badge-status.open { background: #F59E0B22; color: #FBBF24; border: 1px solid #F59E0B44; }
    .badge-status.close { background: #10B98122; color: #34D399; border: 1px solid #10B98144; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="logo-area">
        <div class="logo-badge">💬</div>
        <div class="header-titles">
          <h1>WhatsApp Gateway & Bot Service</h1>
          <p>Smart Warehouse Stock Opname & PPO Progress Reporting</p>
        </div>
      </div>
      <div id="statusBadge" class="status-badge connecting">
        <span class="status-dot"></span>
        <span id="statusText">Memeriksa Koneksi...</span>
      </div>
    </header>

    <div class="grid">
      <!-- Left Card: Live QR Pairing -->
      <div class="card">
        <div class="card-title">
          <span>📲 Hubungkan WhatsApp Bot</span>
          <button class="btn-danger" onclick="resetSession()">Putuskan Sesi</button>
        </div>

        <div id="qrContainer" class="qr-box">
          <p style="color: var(--text-muted); font-size: 14px;">Memuat QR Code...</p>
        </div>

        <ol class="qr-steps">
          <li>Buka aplikasi WhatsApp di smartphone Anda.</li>
          <li>Pilih <b>Perangkat Tertaut (Linked Devices)</b> > <b>Tautkan Perangkat</b>.</li>
          <li>Arahkan kamera ke QR Code di atas. Sesi otomatis tersimpan.</li>
        </ol>
      </div>

      <!-- Right Card: Service Telemetry & Simulator -->
      <div class="card">
        <div class="card-title">
          <span>⚡ Simulator Perintah Bot</span>
          <span style="font-size: 12px; color: var(--text-muted)">Uji 2 Modul Sekaligus</span>
        </div>

        <div class="sim-form">
          <input id="simInput" type="text" class="sim-input" placeholder="Ketik perintah (contoh: !menu, !lapor, !cek ITEM-1)" value="!menu" />
          <div class="quick-chips">
            <span class="chip" onclick="setCmd('!menu')">!menu</span>
            <span class="chip" onclick="setCmd('!lapor')">!lapor (PPO)</span>
            <span class="chip" onclick="setCmd('batal')">batal</span>
            <span class="chip" onclick="setCmd('!cek ITEM-1')">!cek ITEM-1</span>
            <span class="chip" onclick="setCmd('!status')">!status</span>
            <span class="chip" onclick="setCmd('!login admin admin123')">!login admin</span>
            <span class="chip" onclick="setCmd('!faq lampu')">!faq lampu</span>
          </div>
          <button id="simBtn" class="sim-btn" onclick="runSimulate()">Kirim Perintah</button>

          <div id="simOutput" class="sim-output">Hasil balasan bot akan muncul di sini...</div>
        </div>

        <div style="margin-top: 20px;" class="card-title">
          <span>📊 Telemetri Layanan</span>
        </div>
        <div class="stat-list">
          <div class="stat-item">
            <span class="stat-label">Nomor WhatsApp Terhubung</span>
            <span id="statPhone" class="stat-val">-</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Sesi Petugas Aktif</span>
            <span id="statSessions" class="stat-val">0</span>
          </div>
          <div class="stat-item">
            <span class="stat-label">Uptime Layanan</span>
            <span id="statUptime" class="stat-val">0s</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Bottom Card: Recent PPO Reports Table & Excel Download -->
    <div class="card">
      <div class="card-title">
        <span>📋 Laporan Progress Lapangan Terbaru (PPO)</span>
        <a href="/api/reports/download" class="btn-download" target="_blank">
          <span>📥</span> Unduh Laporan Excel (.xlsx)
        </a>
      </div>

      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Waktu</th>
              <th>Pengirim</th>
              <th>Gedung</th>
              <th>Sub Pekerjaan</th>
              <th>Titik Lokasi</th>
              <th>Progres Pekerjaan</th>
              <th>Status</th>
              <th>Kendala</th>
            </tr>
          </thead>
          <tbody id="reportsTableBody">
            <tr>
              <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 24px;">Memuat data laporan terbaru...</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <script>
    function setCmd(cmd) {
      document.getElementById('simInput').value = cmd;
    }

    async function fetchStatus() {
      try {
        const res = await fetch('/api/status');
        const data = await res.json();

        const badge = document.getElementById('statusBadge');
        const statusText = document.getElementById('statusText');
        const qrContainer = document.getElementById('qrContainer');
        const statPhone = document.getElementById('statPhone');
        const statSessions = document.getElementById('statSessions');
        const statUptime = document.getElementById('statUptime');

        badge.className = 'status-badge ' + data.status;

        if (data.status === 'connected') {
          statusText.textContent = '🟢 Terhubung (' + (data.connectedUser ? ('+' + data.connectedUser.id) : 'Aktif') + ')';
          statPhone.textContent = data.connectedUser ? ('+' + data.connectedUser.id) : 'Aktif';
          qrContainer.innerHTML = \`
            <div style="font-size: 50px; margin-bottom: 12px;">✅</div>
            <h3 style="color: #34D399; font-size: 18px; margin-bottom: 6px;">WhatsApp Bot Aktif!</h3>
            <p style="color: var(--text-muted); font-size: 13px; max-width: 280px;">
              Siap melayani Stock Opname Gudang & Laporan Progress PPO secara simultan.
            </p>
          \`;
        } else if (data.status === 'qr_ready' && data.qrDataUrl) {
          statusText.textContent = '🟡 Menunggu Scan QR';
          statPhone.textContent = 'Belum Tertaut';
          qrContainer.innerHTML = \`
            <img class="qr-img" src="\${data.qrDataUrl}" alt="QR Code WhatsApp" />
            <p style="margin-top: 12px; font-size: 13px; color: #FBBF24;">Scan QR sebelum kedaluwarsa</p>
          \`;
        } else if (data.status === 'connecting') {
          statusText.textContent = '🔵 Sedang Menghubungkan...';
          statPhone.textContent = 'Menghubungkan';
          qrContainer.innerHTML = '<p style="color: var(--text-muted);">Menginisialisasi WhatsApp Web Socket...</p>';
        } else {
          statusText.textContent = '🔴 Terputus';
          statPhone.textContent = 'Terputus';
          qrContainer.innerHTML = '<p style="color: #F87171;">Koneksi terputus. Mencoba reconnect...</p>';
        }

        statSessions.textContent = data.activeSessionsCount || 0;
        const mins = Math.floor(data.uptimeSeconds / 60);
        const secs = data.uptimeSeconds % 60;
        statUptime.textContent = mins > 0 ? (mins + 'm ' + secs + 's') : (secs + 's');
      } catch (err) {
        console.error('Status fetch error:', err);
      }
    }

    async function fetchRecentReports() {
      try {
        const res = await fetch('/api/reports/recent?limit=8');
        const data = await res.json();
        const tbody = document.getElementById('reportsTableBody');

        if (!data.reports || data.reports.length === 0) {
          tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 24px;">Belum ada laporan yang tercatat.</td></tr>';
          return;
        }

        let html = '';
        data.reports.forEach(r => {
          const waktu = r['Waktu Input'] || '-';
          const pengirim = r['Nama Pengirim'] || r['Nomor Pengirim'] || '-';
          const gedung = r['Gedung'] || '-';
          const sub = r['Sub Pekerjaan'] || '-';
          const lokasi = r['Titik Lokasi'] || '-';
          const progres = r['Progres'] || r['Progres Pekerjaan'] || '-';
          const status = r['Status'] || 'Open';
          const kendala = r['Kendala'] || '-';
          const statusClass = status.toLowerCase() === 'close' ? 'close' : 'open';

          html += \`
            <tr>
              <td style="white-space: nowrap; font-size: 12px;">\${waktu}</td>
              <td><b>\${pengirim}</b></td>
              <td>\${gedung}</td>
              <td>\${sub}</td>
              <td>\${lokasi}</td>
              <td>\${progres}</td>
              <td><span class="badge-status \${statusClass}">\${status}</span></td>
              <td style="color: var(--text-muted);">\${kendala}</td>
            </tr>
          \`;
        });
        tbody.innerHTML = html;
      } catch (e) {
        console.error('Reports fetch error:', e);
      }
    }

    async function runSimulate() {
      const input = document.getElementById('simInput').value;
      const btn = document.getElementById('simBtn');
      const out = document.getElementById('simOutput');

      if (!input.trim()) return;

      btn.disabled = true;
      btn.textContent = 'Memproses...';
      out.textContent = 'Mengirim perintah ke bot...';

      try {
        const res = await fetch('/api/simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: '6281299998888', message: input })
        });
        const data = await res.json();
        if (data.replies && data.replies.length > 0) {
          let fullText = '';
          data.replies.forEach(r => {
            if (r.text) fullText += r.text + '\\n\\n';
            if (r.caption) fullText += '[Foto Bukti]\\n' + r.caption + '\\n\\n';
          });
          out.textContent = fullText.trim();
        } else {
          out.textContent = '(Tidak ada balasan)';
        }
      } catch (err) {
        out.textContent = 'Error simulator: ' + err.message;
      } finally {
        btn.disabled = false;
        btn.textContent = 'Kirim Perintah';
        fetchStatus();
        fetchRecentReports();
      }
    }

    async function resetSession() {
      if (!confirm('Apakah Anda yakin ingin memutus sesi dan menghapus kredensial WhatsApp?')) return;
      try {
        await fetch('/api/reset-session', { method: 'POST' });
        alert('Sesi berhasil direset. Silakan tunggu QR code baru.');
        fetchStatus();
      } catch (e) {
        alert('Gagal reset: ' + e.message);
      }
    }

    // Polling intervals
    setInterval(fetchStatus, 3000);
    setInterval(fetchRecentReports, 8000);
    fetchStatus();
    fetchRecentReports();
  </script>
</body>
</html>`);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Unified WhatsApp Bot Web Dashboard running on http://0.0.0.0:${PORT}`);
  startBot();
});
