# Smart Warehouse & PPO WhatsApp Bot

Sistem terintegrasi Manajemen Gudang (Stock Opname) dan Pelaporan Progress Pekerjaan Lapangan (PPO) berbasis Web (Vue 3 + Nginx) dan WhatsApp Bot (Node.js Baileys).

---

## 🚀 Cara Menjalankan di Mesin Lain (Docker / Podman)

### Prasyarat
- **Docker** & **Docker Compose** (atau **Podman** & **Podman Compose**)

### Langkah Cepat (1 Perintah)

#### Di Linux / macOS:
```bash
chmod +x start.sh
./start.sh
```
Atau langsung jalankan Docker Compose:
```bash
docker compose up -d --build
```

#### Di Windows:
Cukup klik ganda file **`start.bat`**, atau buka terminal (PowerShell / Command Prompt):
```bat
docker compose up -d --build
# atau jika menggunakan Podman:
podman compose up -d --build
```

---

## 🌐 Layanan yang Berjalan

Setelah kontainer aktif:
- **Web App (Stock Opname):** [http://localhost:3000](http://localhost:3000)
- **WhatsApp Bot Dashboard:** [http://localhost:3001/dashboard](http://localhost:3001/dashboard)
- **Bot API Server:** [http://localhost:3001](http://localhost:3001)

---

## 🔑 Akun Login Default Web App & Bot

| Role | Username | Password |
|---|---|---|
| **Admin** | `admin` | `admin123` |
| **Operator / Staff** | `user1` | `user123` |
| **Operator / Staff** | `staff` | `staff123` |

---

## 📱 WhatsApp Bot & Autentikasi

- **Sesi WhatsApp Aktif**: Folder `wabot/auth_info_baileys/` sudah memuat seluruh kunci sesi WhatsApp yang terpasangkan sebelumnya. Bot akan **langsung terhubung** tanpa perlu scan QR ulang.
- **Pemicu Bantuan / Tutorial di WA**: Kirim pesan seperti `hey`, `halo`, `p`, `tutorial`, atau `!menu` untuk melihat panduan lengkap perintah bot.
- **Perintah Penting WA**:
  - `!cari <nama_barang>` atau langsung ketik nama/kode material (misal: `wago`, `ITEM-1`, `san disk 64`)
  - `!opname <kode> <qty>` (setelah login via `!login <user> <pass>`)
  - `!lapor` (memulai laporan progres pekerjaan PPO)
  - `batal` (membatalkan pengisian laporan)

---

## 📂 Struktur Direktori

```text
├── docker-compose.yml       # Konfigurasi orkestrasi Docker multi-kontainer
├── start.bat                # Script peluncur otomatis untuk Windows
├── start.sh                 # Script peluncur otomatis untuk Linux/macOS
├── .env                     # Konfigurasi Google Sheets & Apps Script
├── web/                     # Frontend Vue 3 + Nginx
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── dist/                # Bundle statis hasil build
│   └── src/                 # Source code Vue 3
├── wabot/                   # Backend WhatsApp Bot & Dashboard
│   ├── Dockerfile
│   ├── auth_info_baileys/   # Kunci sesi Baileys WhatsApp yang aktif
│   └── src/                 # Server & handler pesan
├── data/                    # Database & Spreadsheet operasional
│   └── ppo/                 # Laporan progress, titik lokasi, FAQ
└── GAS/                     # Source code Google Apps Script backend
```
