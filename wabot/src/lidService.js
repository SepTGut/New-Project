/**
 * LID Service for Baileys Multi-Device WhatsApp Bot (lidService.js)
 * Resolves Linked Device Identifiers (@lid) to standard Phone JIDs (@s.whatsapp.net).
 *
 * WhatsApp Multi-Device privacy updates assign companion devices and newer accounts
 * random LIDs instead of raw phone numbers. This service maintains a persistent bidirectional
 * mapping between LIDs and Phone JIDs, auto-learning from:
 * 1. Baileys contact sync events ('contacts.upsert', 'contacts.update')
 * 2. User authentication (!login)
 * 3. Seeded admin phone from environment configuration
 * 4. Existing Baileys session files
 */

const fs = require('fs');
const path = require('path');
const logger = require('./logger');

let authFolder = path.join(__dirname, '../auth_info_baileys');
let lidMapPath = path.join(authFolder, 'lid_map.json');

// Memory maps:
// lidToPhone: '43284831453184' -> '6282139540559'
// phoneToLid: '6282139540559' -> '43284831453184'
const lidToPhone = new Map();
const phoneToLid = new Map();

/**
 * Normalizes any JID, LID, or phone string to bare digits
 */
function toDigits(str) {
  if (!str) return '';
  return String(str)
    .split('@')[0]
    .split(':')[0]
    .replace(/[^\d]/g, '');
}

/**
 * Normalizes an LID JID (e.g. "43284831453184:88@lid" -> "43284831453184@lid")
 */
function normalizeLidJid(jid) {
  const digits = toDigits(jid);
  return digits ? `${digits}@lid` : '';
}

/**
 * Normalizes a Phone JID (e.g. "6282139540559:0@s.whatsapp.net" -> "6282139540559@s.whatsapp.net")
 */
function normalizePhoneJid(phoneOrJid) {
  let str = String(phoneOrJid || '').trim();
  str = str.split('@')[0].split(':')[0].replace(/[^\d+]/g, '');
  if (str.startsWith('+')) str = str.substring(1);
  if (str.startsWith('0')) str = '62' + str.substring(1);
  else if (str.startsWith('8')) str = '62' + str;
  return str ? `${str}@s.whatsapp.net` : '';
}

/**
 * Persists in-memory mappings to lid_map.json
 */
function saveLidMap() {
  try {
    if (!fs.existsSync(authFolder)) {
      fs.mkdirSync(authFolder, { recursive: true });
    }
    const data = {};
    for (const [lid, phone] of lidToPhone.entries()) {
      data[lid] = phone;
    }
    fs.writeFileSync(lidMapPath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    logger.warn('LID', `Gagal menyimpan lid_map.json: ${err.message}`);
  }
}

/**
 * Registers or updates an LID-to-Phone mapping
 * @param {string} lid - LID string or JID
 * @param {string} phone - Phone number or JID
 * @param {string} source - Context/source for logging
 */
function setMapping(lid, phone, source = '') {
  const lidDigits = toDigits(lid);
  const phoneJid = normalizePhoneJid(phone);
  const phoneDigits = toDigits(phoneJid);

  if (!lidDigits || !phoneDigits || lidDigits === phoneDigits) {
    return false;
  }

  const prev = lidToPhone.get(lidDigits);
  if (prev === phoneDigits) {
    return true; // Already mapped identically
  }

  lidToPhone.set(lidDigits, phoneDigits);
  phoneToLid.set(phoneDigits, lidDigits);
  saveLidMap();

  logger.info('LID', `Pemetaan LID terdaftar: ${lidDigits}@lid -> +${phoneDigits}${source ? ` (${source})` : ''}`);
  return true;
}

/**
 * Looks up phone JID from an LID or JID
 * @param {string} jid
 * @returns {string|null} Full phone JID (e.g. "6282139540559@s.whatsapp.net") or null
 */
function getPhoneJid(jid) {
  if (!jid) return null;
  const digits = toDigits(jid);
  if (!digits) return null;

  // If already a standard phone JID and not an LID
  if (jid.endsWith('@s.whatsapp.net') && !lidToPhone.has(digits)) {
    return normalizePhoneJid(jid);
  }

  const mappedPhoneDigits = lidToPhone.get(digits);
  if (mappedPhoneDigits) {
    return `${mappedPhoneDigits}@s.whatsapp.net`;
  }

  return null;
}

/**
 * Looks up LID from a phone number or JID
 * @param {string} phoneOrJid
 * @returns {string|null} Full LID JID or null
 */
function getLid(phoneOrJid) {
  const digits = toDigits(phoneOrJid);
  const mappedLid = phoneToLid.get(digits);
  return mappedLid ? `${mappedLid}@lid` : null;
}

/**
 * Resolves incoming message sender JID.
 * If sender is using an @lid JID, attempts translation to registered phone JID.
 *
 * @param {string} rawJid - Raw incoming remoteJid
 * @returns {{ resolvedJid: string, originalJid: string, phone: string, isLid: boolean, isResolved: boolean }}
 */
function resolveSender(rawJid) {
  if (!rawJid) {
    return { resolvedJid: '', originalJid: '', phone: '', isLid: false, isResolved: false };
  }

  const isLid = rawJid.endsWith('@lid');
  const rawDigits = toDigits(rawJid);

  if (!isLid) {
    const cleanPhoneJid = normalizePhoneJid(rawJid);
    const phone = toDigits(cleanPhoneJid);
    return {
      resolvedJid: cleanPhoneJid,
      originalJid: rawJid,
      phone,
      isLid: false,
      isResolved: true
    };
  }

  // Sender is @lid
  const mappedPhoneDigits = lidToPhone.get(rawDigits);
  if (mappedPhoneDigits) {
    const resolvedJid = `${mappedPhoneDigits}@s.whatsapp.net`;
    return {
      resolvedJid,
      originalJid: rawJid,
      phone: mappedPhoneDigits,
      isLid: true,
      isResolved: true
    };
  }

  // Unresolved LID
  return {
    resolvedJid: rawJid,
    originalJid: rawJid,
    phone: rawDigits,
    isLid: true,
    isResolved: false
  };
}

/**
 * Processes contacts from Baileys contacts.upsert / contacts.update
 */
function handleContacts(contacts) {
  if (!contacts) return;
  const list = Array.isArray(contacts) ? contacts : [contacts];

  for (const c of list) {
    if (!c) continue;
    const id = c.id || '';
    const lid = c.lid || (id.endsWith('@lid') ? id : '');
    const jid = c.jid || (id.endsWith('@s.whatsapp.net') ? id : '');
    const phone = c.phoneNumber ? `${c.phoneNumber}@s.whatsapp.net` : '';

    const targetPhone = jid || phone;
    if (lid && targetPhone && toDigits(lid) !== toDigits(targetPhone)) {
      setMapping(lid, targetPhone, `Baileys Contact: ${c.name || c.notify || 'sync'}`);
    }
  }
}

/**
 * Initializes LID mapping service
 * @param {string} customAuthFolder
 */
function initLidService(customAuthFolder) {
  if (customAuthFolder) {
    authFolder = customAuthFolder;
    lidMapPath = path.join(authFolder, 'lid_map.json');
  }

  // 1. Load existing persisted mappings
  if (fs.existsSync(lidMapPath)) {
    try {
      const raw = fs.readFileSync(lidMapPath, 'utf8');
      const data = JSON.parse(raw);
      for (const [lid, phone] of Object.entries(data)) {
        const ld = toDigits(lid);
        const pd = toDigits(phone);
        if (ld && pd) {
          lidToPhone.set(ld, pd);
          phoneToLid.set(pd, ld);
        }
      }
      logger.info('LID', `Memuat ${lidToPhone.size} pemetaan LID dari ${path.basename(lidMapPath)}`);
    } catch (e) {
      logger.warn('LID', `Gagal membaca file ${lidMapPath}: ${e.message}`);
    }
  }

  // 2. Pre-seed admin number from environment
  const adminNum = process.env.ADMIN_NOTIFY_NUMBER || '6282139540559';
  const cleanAdmin = toDigits(adminNum);
  if (cleanAdmin) {
    // If admin LID is known from active session files
    const knownAdminLid = '43284831453184';
    if (!lidToPhone.has(knownAdminLid)) {
      setMapping(knownAdminLid, cleanAdmin, 'Seeded Admin');
    }
  }
}

module.exports = {
  initLidService,
  setMapping,
  getPhoneJid,
  getLid,
  resolveSender,
  handleContacts,
  normalizePhoneJid,
  normalizeLidJid,
  toDigits,
  saveLidMap
};
