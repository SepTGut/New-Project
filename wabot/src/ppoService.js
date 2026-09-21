/**
 * PPO (Perencanaan & Pengendalian Operasi) Service Module
 * Handles field job progress reports, master location lookup,
 * Excel report generation with embedded photos, FAQ search, and cloud sync.
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const ExcelJS = require('exceljs');
const axios = require('axios');
require('dotenv').config();

// Determine data directory (default to ../../data/ppo locally or /app/data in Docker)
function resolveDataDir() {
  const candidates = [
    process.env.DATA_DIR,
    path.join(__dirname, '../../data/ppo'),
    path.join(__dirname, '../data/ppo'),
    path.join(__dirname, '../data'),
    path.join(process.cwd(), 'data/ppo')
  ];

  for (const c of candidates) {
    if (c && fs.existsSync(c)) {
      return c;
    }
  }
  // Default fallback
  const def = path.join(__dirname, '../../data/ppo');
  try { fs.mkdirSync(def, { recursive: true }); } catch (e) {}
  return def;
}

const DATA_DIR = resolveDataDir();
const DATA_FILE_PATH = path.join(DATA_DIR, 'data-titik-lokasi.xlsx');
const LAPORAN_FILE_PATH = path.join(DATA_DIR, 'laporan-progress.xlsx');
const LAPORAN_CADANGAN_PATH = path.join(DATA_DIR, 'laporan-progress-cadangan.xlsx');
const FAQ_FILE_PATH = path.join(DATA_DIR, 'faq.xlsx');
const FOLDER_FOTO = path.join(DATA_DIR, 'foto-laporan');
const SESI_FILE_PATH = path.join(DATA_DIR, 'sesi-aktif.json');

// Ensure foto directory exists
try { fs.mkdirSync(FOLDER_FOTO, { recursive: true }); } catch (e) {}

const PPO_APPS_SCRIPT_URL = process.env.PPO_APPS_SCRIPT_URL ||
  'https://script.google.com/macros/s/AKfycbxQtwgSTXFNIdXcBk5B4SqErtIzP9NFKw7_JJUUlV4wZUMiy1ESw8hLmIWRG6AlirNm7g/exec';
const PPO_APPS_SCRIPT_TOKEN = process.env.PPO_APPS_SCRIPT_TOKEN || 'tewelmambu123';

const KOLOM_MASTER = {
  GEDUNG: 'Nama Gedung',
  SUB: 'Sub Pekerjaan',
  LOKASI: 'Titik Lokasi',
  KET: 'Keterangan'
};

const KOLOM_LAPORAN = [
  'Waktu Input',
  'Nomor Pengirim',
  'Nama Pengirim',
  'Gedung',
  'Tanggal Pengerjaan',
  'Jam Selesai',
  'Sub Pekerjaan',
  'Titik Lokasi',
  'Progres',
  'Status',
  'Kendala',
  'Foto Bukti'
];

let cacheGedung = [];
let cacheMasterData = [];

/**
 * Loads and caches master locations from data-titik-lokasi.xlsx
 */
function muatDataTitikLokasi() {
  if (!fs.existsSync(DATA_FILE_PATH)) {
    console.warn(`[PPO] Master file ${DATA_FILE_PATH} not found.`);
    return { gedung: [], data: [] };
  }

  try {
    const workbook = XLSX.readFile(DATA_FILE_PATH);
    const sheetPertama = workbook.SheetNames[0];
    // range: 1 skips row 1 (legend), uses row 2 as headers
    const data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetPertama], { range: 1, defval: null });

    // Fill-down: rows inheriting previous Gedung / Sub Pekerjaan
    let gedungTerakhir = null;
    let subTerakhir = null;
    const dataDiisi = data.map((baris) => {
      if (baris[KOLOM_MASTER.GEDUNG]) gedungTerakhir = String(baris[KOLOM_MASTER.GEDUNG]).trim();
      if (baris[KOLOM_MASTER.SUB]) subTerakhir = String(baris[KOLOM_MASTER.SUB]).trim();
      return {
        ...baris,
        [KOLOM_MASTER.GEDUNG]: baris[KOLOM_MASTER.GEDUNG] || gedungTerakhir,
        [KOLOM_MASTER.SUB]: baris[KOLOM_MASTER.SUB] || subTerakhir,
      };
    });

    const dataBersih = dataDiisi.filter(
      (b) => b[KOLOM_MASTER.GEDUNG] && b[KOLOM_MASTER.SUB] && b[KOLOM_MASTER.LOKASI]
    );

    cacheMasterData = dataBersih;

    // Extract unique buildings
    const setGedung = new Set();
    dataBersih.forEach(row => {
      const g = String(row[KOLOM_MASTER.GEDUNG] || '').trim();
      if (g) setGedung.add(g);
    });

    cacheGedung = Array.from(setGedung);
    return { gedung: cacheGedung, data: cacheMasterData };
  } catch (err) {
    console.error('[PPO] Error reading data-titik-lokasi.xlsx:', err.message);
    return { gedung: [], data: [] };
  }
}

// Initial load
muatDataTitikLokasi();

function getDaftarGedung() {
  if (cacheGedung.length === 0) muatDataTitikLokasi();
  return cacheGedung;
}

function ambilTitikLokasi(gedung, subPekerjaan) {
  if (cacheMasterData.length === 0) muatDataTitikLokasi();
  const cleanG = String(gedung || '').trim().toLowerCase();
  const cleanSub = String(subPekerjaan || '').trim().toLowerCase();

  const matches = cacheMasterData.filter(row => {
    const rG = String(row[KOLOM_MASTER.GEDUNG] || '').trim().toLowerCase();
    const rSub = String(row[KOLOM_MASTER.SUB] || '').trim().toLowerCase();
    return rG === cleanG && rSub === cleanSub;
  });

  // Deduplicate location names
  const seen = new Set();
  const unique = [];
  for (const item of matches) {
    const nama = String(item[KOLOM_MASTER.LOKASI] || '').trim();
    if (nama && !seen.has(nama.toLowerCase())) {
      seen.add(nama.toLowerCase());
      unique.push(item);
    }
  }
  return unique;
}

/**
 * Writes one report row into Excel and embeds image if present
 */
async function tulisSatuLaporanKeExcel(filePath, barisData, namaFileFoto) {
  const workbook = new ExcelJS.Workbook();
  let sheet = null;

  if (fs.existsSync(filePath)) {
    try {
      await workbook.xlsx.readFile(filePath);
      sheet = workbook.worksheets[0];
    } catch (readErr) {
      console.warn(`[PPO] Could not read existing ${filePath}, creating fresh:`, readErr.message);
      sheet = workbook.addWorksheet('Laporan Progress');
    }
  } else {
    sheet = workbook.addWorksheet('Laporan Progress');
  }

  // Ensure headers exist
  if (sheet.rowCount < 1 || !sheet.getRow(1).values || sheet.getRow(1).values.length <= 1) {
    sheet.columns = KOLOM_LAPORAN.map(k => ({ header: k, key: k, width: 18 }));
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1A237E' }
    };
  }

  const valuesRow = KOLOM_LAPORAN.map(k => barisData[k] || '');
  const newRow = sheet.addRow(valuesRow);
  const rowNumber = newRow.number;

  // Center align standard columns
  sheet.getRow(rowNumber).alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  sheet.getCell(`A${rowNumber}`).alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.getCell(`E${rowNumber}`).alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.getCell(`F${rowNumber}`).alignment = { vertical: 'middle', horizontal: 'center' };
  sheet.getCell(`J${rowNumber}`).alignment = { vertical: 'middle', horizontal: 'center' };

  // Embed photo in Excel if exists
  if (namaFileFoto) {
    const fotoPath = path.join(FOLDER_FOTO, namaFileFoto);
    if (fs.existsSync(fotoPath)) {
      try {
        const imageId = workbook.addImage({
          filename: fotoPath,
          extension: 'jpeg'
        });
        sheet.addImage(imageId, {
          tl: { col: KOLOM_LAPORAN.length - 1, row: rowNumber - 1 },
          ext: { width: 90, height: 90 }
        });
        sheet.getRow(rowNumber).height = 75;
      } catch (imgErr) {
        console.warn('[PPO] Failed embedding photo in Excel row:', imgErr.message);
      }
    }
  }

  await workbook.xlsx.writeFile(filePath);
}

/**
 * Sends report to Google Sheets Apps Script webhook
 */
async function kirimKeGoogleSheets(barisBaru, namaFileFoto) {
  if (!PPO_APPS_SCRIPT_URL) return false;

  const payload = {
    token: PPO_APPS_SCRIPT_TOKEN,
    ...barisBaru
  };

  if (namaFileFoto) {
    const fotoPath = path.join(FOLDER_FOTO, namaFileFoto);
    if (fs.existsSync(fotoPath)) {
      try {
        const buffer = fs.readFileSync(fotoPath);
        payload.fotoBase64 = buffer.toString('base64');
        payload.fotoMime = 'image/jpeg';
      } catch (err) {}
    }
  }

  try {
    const res = await axios.post(PPO_APPS_SCRIPT_URL, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 25000
    });
    return res.data && res.data.ok;
  } catch (err) {
    console.warn('[PPO] Cloud Google Sheets sync notice:', err.message);
    return false;
  }
}

/**
 * Saves complete report to local Excel and syncs to cloud
 */
async function simpanLaporan(data) {
  const waktuInput = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });

  const barisBaru = {
    waktuInput,
    pengirim: data.pengirim,
    namaPengirim: data.namaPengirim || 'Petugas Lapangan',
    gedung: data.gedung,
    tanggalMulai: data.tanggalMulai,
    jamSelesai: data.jamSelesai,
    subPekerjaan: data.subPekerjaan,
    titikLokasi: data.titikLokasi,
    progres: data.progres,
    status: data.status,
    kendala: data.kendala || '-'
  };

  const barisBaruExcel = {
    'Waktu Input': waktuInput,
    'Nomor Pengirim': data.pengirim,
    'Nama Pengirim': data.namaPengirim || 'Petugas Lapangan',
    'Gedung': data.gedung,
    'Tanggal Pengerjaan': data.tanggalMulai,
    'Jam Selesai': data.jamSelesai,
    'Sub Pekerjaan': data.subPekerjaan,
    'Titik Lokasi': data.titikLokasi,
    'Progres': data.progres,
    'Status': data.status,
    'Kendala': data.kendala || '-',
    'Foto Bukti': data.namaFileFoto || '-'
  };

  // 1. Write to primary local Excel
  let localSaved = false;
  try {
    await tulisSatuLaporanKeExcel(LAPORAN_FILE_PATH, barisBaruExcel, data.namaFileFoto);
    localSaved = true;
  } catch (err) {
    console.error('[PPO] Primary Excel write failed, trying backup file:', err.message);
    try {
      await tulisSatuLaporanKeExcel(LAPORAN_CADANGAN_PATH, barisBaruExcel, data.namaFileFoto);
      localSaved = true;
    } catch (e2) {}
  }

  // 2. Dual-sync to Google Sheets (fire-and-forget / non-blocking)
  kirimKeGoogleSheets(barisBaru, data.namaFileFoto).catch(() => {});

  return {
    berhasil: localSaved,
    waktu: waktuInput,
    data: barisBaruExcel
  };
}

/**
 * Searches FAQ database
 */
function cariFaq(query) {
  if (!fs.existsSync(FAQ_FILE_PATH)) return [];
  const cleanQ = String(query || '').trim().toLowerCase();
  if (!cleanQ) return [];

  try {
    const workbook = XLSX.readFile(FAQ_FILE_PATH);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawFaq = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    return rawFaq.filter(item => {
      const q = String(item['Pertanyaan'] || item['pertanyaan'] || item['Question'] || '').toLowerCase();
      const a = String(item['Jawaban'] || item['jawaban'] || item['Answer'] || '').toLowerCase();
      return q.includes(cleanQ) || a.includes(cleanQ);
    }).slice(0, 5);
  } catch (err) {
    console.error('[PPO] FAQ search error:', err.message);
    return [];
  }
}

/**
 * Reads recent reports for dashboard
 */
async function getRecentReports(limit = 10) {
  if (!fs.existsSync(LAPORAN_FILE_PATH)) return [];

  try {
    const workbook = XLSX.readFile(LAPORAN_FILE_PATH);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    return rows.reverse().slice(0, limit);
  } catch (err) {
    console.error('[PPO] Error reading recent reports:', err.message);
    return [];
  }
}

/**
 * Session persistence helper for ongoing in-progress reports
 */
function muatSesiAktif() {
  if (!fs.existsSync(SESI_FILE_PATH)) return new Map();
  try {
    const raw = JSON.parse(fs.readFileSync(SESI_FILE_PATH, 'utf8'));
    return new Map(Object.entries(raw));
  } catch (e) {
    return new Map();
  }
}

function simpanSesiAktif(map) {
  try {
    const obj = Object.fromEntries(map);
    fs.writeFileSync(SESI_FILE_PATH, JSON.stringify(obj, null, 2), 'utf8');
  } catch (e) {}
}

module.exports = {
  DATA_DIR,
  FOLDER_FOTO,
  LAPORAN_FILE_PATH,
  getDaftarGedung,
  ambilTitikLokasi,
  simpanLaporan,
  cariFaq,
  getRecentReports,
  muatSesiAktif,
  simpanSesiAktif,
  muatDataTitikLokasi
};
