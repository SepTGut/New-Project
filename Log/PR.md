# Pull Request & Release Notes

## Release v2.0: Full Modernization, Dockerized Web Architecture & Warehouse Intelligence

### 🎯 Overview
Complete 3-step modernization transforming the Stock Opname system from a monolithic Streamlit prototype into an enterprise-ready, containerized Progressive Web Application (Vue 3 + Vite) backed by an optimized Google Apps Script cloud API.

---

### 📦 Key Features & Changes

#### 1. Google Apps Script Backend Overhaul (`GAS/`)
* **Modularization:** Monolithic `Kode.js` split into `Config.js`, `Auth.js`, `DriveService.js`, `SheetService.js`, and `Controller.js`.
* **0-Second Live Inventory Sync:** Enhanced `doGet?action=inventory` to stream live spreadsheet data, eliminating the 1–5 minute published CSV delay.
* **Spreadsheet-Backed User Accounts:** Dynamic `"Users"` sheet tab allows managers to add and modify staff accounts and roles without modifying code.
* **Concurrency Safety:** Writes protected with `LockService.getScriptLock()` (30s timeout).
* **Dynamic Header Resolution:** Automatic column header inspection prevents breakages when columns are reordered.

#### 2. Containerized Web Frontend (`web/`)
* **Vue 3 + Vite SPA:** High-speed, responsive frontend with a glassmorphic dark purple theme.
* **Client-Side Canvas Processing:** All image resizing (max 1600px, JPEG 0.75) and side-by-side composite photo stitching (`gabungan.jpg`) occur inside the browser using HTML5 Canvas.
* **Camera Barcode & QR Code Scanner:** Integrated scanner modal (`html5-qrcode`) with rear camera priority, audio/haptic feedback, and instant auto-fill into search or new item forms.
* **Audit CSV Export:** 1-click export of filtered inventory lists with Excel UTF-8 BOM compatibility.
* **PWA & Offline Resilience:** `manifest.json` and 3-tier caching strategy (Live GAS JSON -> Published CSV -> Local Storage) with real-time offline connection status badge.
* **Docker Multi-Stage Build:** `Dockerfile` (`node:20-alpine` builder -> `nginx:alpine` runtime) and root `docker-compose.yml` exposing the app on port `3000`.

---

### 🧪 Verification & Build Status
* **GAS Deployment:** `clasp push` completed successfully (7 files deployed).
* **Web Dependencies:** Installed cleanly via `npm install` (0 vulnerabilities).
* **Web Production Build:** `npm run build` compiled in 1.41s with 0 errors.
