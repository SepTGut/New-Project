/**
 * Baileys WhatsApp Connection Manager (bot.js)
 * Manages multi-device socket lifecycle, QR pairing state, auto-reconnection,
 * and passes incoming messages to the message handler.
 */

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const QRCode = require('qrcode');
const pino = require('pino');
const path = require('path');
const fs = require('fs');
const { handleMessage } = require('./handlers/messageHandler');

const AUTH_FOLDER = process.env.AUTH_FOLDER || path.join(__dirname, '../auth_info_baileys');

// Internal connection state accessible by Express server
const botState = {
  status: 'disconnected', // 'disconnected' | 'connecting' | 'qr_ready' | 'connected'
  qrRaw: '',
  qrDataUrl: '',
  connectedUser: null,
  startedAt: new Date(),
  lastDisconnectReason: null,
  sock: null
};

/**
 * Initializes or reconnects the WhatsApp Baileys socket
 */
async function startBot() {
  try {
    if (!fs.existsSync(AUTH_FOLDER)) {
      fs.mkdirSync(AUTH_FOLDER, { recursive: true });
    }

    botState.status = 'connecting';
    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);

    // Fetch latest version or fall back safely
    let version = [2, 3000, 1015901307];
    try {
      const v = await fetchLatestBaileysVersion();
      if (v && v.version) version = v.version;
    } catch (e) {}

    const sock = makeWASocket({
      version,
      auth: state,
      logger: pino({ level: 'silent' }),
      browser: ['Smart Warehouse WABot', 'Chrome', '120.0.0']
    });

    botState.sock = sock;

    // Credentials update hook
    sock.ev.on('creds.update', saveCreds);

    // Connection state lifecycle
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        botState.status = 'qr_ready';
        botState.qrRaw = qr;
        try {
          botState.qrDataUrl = await QRCode.toDataURL(qr, {
            errorCorrectionLevel: 'M',
            margin: 2,
            width: 340
          });
        } catch (qrErr) {
          console.error('Error generating QR Data URL:', qrErr);
        }
        console.log('📱 WhatsApp Pairing QR Code generated! Scan from phone or visit dashboard.');
      }

      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401;
        botState.status = 'disconnected';
        botState.qrRaw = '';
        botState.qrDataUrl = '';
        botState.connectedUser = null;
        botState.lastDisconnectReason = lastDisconnect?.error?.message || `Status code: ${statusCode}`;

        console.log(`Connection closed: ${botState.lastDisconnectReason} (Status code: ${statusCode})`);

        if (isLoggedOut) {
          console.log('⚠️ Sesi WhatsApp kedaluwarsa/logout. Membersihkan sesi dan membuat QR baru...');
          clearAuthFolder();
          // Restart to generate fresh pairing QR code
          setTimeout(startBot, 2000);
        } else {
          // Temporary network hiccup, auto-reconnect
          setTimeout(startBot, 4000);
        }
      } else if (connection === 'open') {
        botState.status = 'connected';
        botState.qrRaw = '';
        botState.qrDataUrl = '';
        botState.connectedUser = sock.user;
        const phoneNum = sock.user?.id ? sock.user.id.split(':')[0] : 'Unknown';
        console.log(`✅ WhatsApp Bot connected successfully as +${phoneNum}!`);
      }
    });

    // Incoming messages
    sock.ev.on('messages.upsert', async (m) => {
      if (!m.messages || m.messages.length === 0) return;
      for (const msg of m.messages) {
        // Skip messages sent by the bot itself
        if (msg.key.fromMe) continue;
        await handleMessage(sock, msg);
      }
    });

    return sock;
  } catch (err) {
    console.error('Fatal error starting WhatsApp Bot:', err);
    botState.status = 'disconnected';
    setTimeout(startBot, 6000);
  }
}

/**
 * Deletes all files inside the auth folder WITHOUT removing the folder itself.
 * Needed because Docker volume mounts lock the directory mountpoint (EBUSY).
 */
function clearAuthFolder() {
  try {
    if (!fs.existsSync(AUTH_FOLDER)) return;
    const entries = fs.readdirSync(AUTH_FOLDER);
    for (const entry of entries) {
      const fullPath = path.join(AUTH_FOLDER, entry);
      try {
        fs.rmSync(fullPath, { recursive: true, force: true });
      } catch (e) {
        console.warn('Could not remove auth file:', fullPath, e.message);
      }
    }
    console.log(`✅ Auth folder cleared (${entries.length} files removed).`);
  } catch (err) {
    console.error('Error clearing auth folder contents:', err.message);
  }
}

/**
 * Resets local auth session files to allow re-pairing
 */
async function resetAuthSession() {
  try {
    if (botState.sock) {
      try {
        await botState.sock.logout();
      } catch (e) {}
    }
    clearAuthFolder();
    setTimeout(startBot, 1000);
    return { success: true, message: 'Auth session reset successfully. Scan QR to re-pair.' };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

module.exports = {
  startBot,
  botState,
  resetAuthSession
};
