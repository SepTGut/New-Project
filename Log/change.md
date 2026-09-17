# Changelog & Update Records

All notable changes and architectural transitions are documented in this file.

---

## [Initial Setup & Baseline Audit] - 2026-09-16
### Added
- Created `.streamlit/secrets.toml` with default SHA-256 hashed `admin` and `staff` user accounts.
- Created `.env` storing `DATABASE_URL`, `APPS_SCRIPT_URL`, `SPREADSHEET_ID`, and `DRIVE_FOLDER_ID`.
- Created `.gitignore` to prevent secret leakage (`.env`, `secrets.toml`, `.clasprc.json`).
- Installed all missing baseline dependencies (`streamlit`, `pandas`, `Pillow`, `requests`, etc.).
- Cloned Google Apps Script project into `GAS/` using `clasp`.
- Created `Log/` folder containing `plan.md`, `documentation.md`, `Readme.md`, `change.md`, and `PR.md`.

---

## [Phase 1: GAS Modularization & Optimization] - 2026-09-16
### Completed
- **Deconstructed monolithic `GAS/Kode.js`** into 5 single-responsibility modules:
  - `Config.js`: Centralized spreadsheet/drive IDs, timeouts, and column header definitions.
  - `Auth.js`: API Key authentication validation helper.
  - `DriveService.js`: Encapsulated photo upload, Base64 decoding, and Drive permissions.
  - `SheetService.js`: Dynamic header mapping, selective column scanning, and `LockService` write serialization.
  - `Controller.js`: Dispatcher for `doGet` and `doPost`, standardized JSON output, backward-compatibility shims.
- **Removed `GAS/Kode.js`**: Replaced entirely by the modular architecture.
- **Pushed to Google Apps Script**: Successfully deployed with `clasp push` with zero errors.

---

## [Phase 2: Migration to Dockerized Web App (Vue 3 + Vite)] - 2026-09-16
### Completed
- **Built Vue 3 + Vite SPA (`web/`)**:
  - `web/src/assets/style.css`: Preserved and elevated the purple glassmorphic dark design system.
  - `web/src/utils/imageUtils.js`: Implemented client-side Canvas-based photo compression (max 1600px, JPEG 0.75) and dynamic side-by-side photo stitching (`gabungan.jpg`), removing server-side processing overhead.
  - `web/src/services/api.js`: Real-time inventory querying from Google Sheets with cache-busting and POST integration to Google Apps Script.
  - `web/src/services/auth.js`: Web Crypto API SHA-256 client authentication supporting `admin` and `staff` roles with persistent `localStorage` session state.
  - `web/src/components/`: Created `LoginForm.vue`, `SearchBar.vue`, `ItemCard.vue`, and `AddItemForm.vue`.
  - `web/src/App.vue`: Orchestrated tab navigation, live inventory filtering, and logout controls.
- **Containerization**:
  - `web/Dockerfile`: Multi-stage build (`node:20-alpine` build -> `nginx:alpine` runtime).
  - `web/nginx.conf`: Gzip compression and SPA routing configuration.
  - `docker-compose.yml`: Root orchestrator configured to expose web client on port `3000`.
- **Validation**:
  - Successfully verified dependencies (`npm install`) and production build (`npm run build` completed cleanly in 617ms).

---

## [Phase 3: Optimizations & Warehouse Intelligence] - 2026-09-16
### Completed
- **Google Apps Script Live Sync & User Auth (`GAS/`)**:
  - `SheetService.js`: Implemented `getAllItems()` for 0-second live inventory read directly from the spreadsheet. Added `getUsersSheet()` and `verifyUser()` to support accounts managed directly in a `"Users"` sheet tab.
  - `Controller.js`: Added `doGet?action=inventory` endpoint returning real-time JSON with execution time metrics and added `doPost` action `'login'` for remote credential verification.
  - `Config.js`: Migrated hardcoded IDs to native Google Apps Script environment variables (`PropertiesService.getScriptProperties()`) with dynamic getters and fallback support. Added `initializeScriptProperties()` helper.
  - Deployed to Google Apps Script via `sync_and_deploy.ps1` (Version 10 is now live).
- **Integrated Camera Barcode & QR Code Scanner (`web/`)**:
  - Installed `html5-qrcode` and built `BarcodeScannerModal.vue` with rear camera priority, audio/vibration detection feedback, and dark backdrop overlay.
  - Wired scanner to search bar for instant inventory lookup and to `AddItemForm.vue` for 1-click material code intake.
- **One-Click Audit CSV Export (`web/`)**:
  - Created `exportUtils.js` to download timestamped CSV files (`stock_opname_audit_YYYYMMDD_HHMMSS.csv`) with Excel UTF-8 BOM compatibility.
- **Progressive Web App (PWA) & Offline Resilience (`web/`)**:
  - Created `manifest.json` and `icon.svg` enabling "Add to Home Screen" on mobile devices.
  - Configured 3-tier inventory fetch strategy (Live GAS JSON -> Published CSV -> Local Storage Cache) with real-time offline connection status badge.
- **Streamlined Inventory Cards**:
  - Configured [ItemCard.vue](file:///d:/MyCode/New-Project/web/src/components/ItemCard.vue) and `app.py` to display strictly **one single main photo of the whole item** (`Foto 1`) with safe fallback, eliminating duplicate side-by-side images from cluttering the search view.
- **Deprecated & Removed Legacy Streamlit Prototype**:
  - Deleted `app.py`, `requirements.txt`, and `.streamlit/` folder as the system is now 100% powered by the modern Vue 3 + Vite containerized web application.
- **Build Verification**:
  - Verified `npm run build` inside `web/` with 0 errors (built in 1.42s).

---

## [Migration to New Spreadsheet & Apps Script Project] - 2026-09-16
### Completed
- **Spreadsheet Migration**:
  - Migrated target to new Google Spreadsheet ID `1_HvmBaEqFpOCBPXJuI4eMbhsKIDe5RhOrHo7h2kqt2c`.
  - Added **Dynamic Header Row Detection (`findHeaderRow`)** to `GAS/SheetService.js` and CSV parser in `web/src/services/api.js` to seamlessly support the title banner layout where headers reside on **Row 5** (`PictFinder` tab GID `1367299058`).
  - Added auto-initialization for the **`User`** tab (GID `1894615367`): injects `Username`, `PasswordHash`, `Role`, `Status`, `CreatedAt` headers and default `admin` and `staff` accounts when empty.
  - Added support for sequence numbering (`No` column) and single photo link column (`Link Foto`).
- **Google Apps Script Backend**:
  - Connected clasp to new Script ID `1NZBn5MFU0NMl3fshjMTwaqL7OcbVRJ7tWZiXZSP-7a_OWQak8cN0wWS4`.
  - Pushed all 7 backend modules (`appsscript.json`, `Auth.js`, `Config.js`, `Controller.js`, `DriveService.js`, `index.html`, `SheetService.js`).
  - Created new Web App deployment `AKfycbwlF3YI9-Npgr0MaL9M_ZtYC7MCQP2AWG9qzJ77cFHsM9X0O3dbnpP-wfIJTpGybeT7` (Version 2).
  - Updated `GAS/sync_and_deploy.ps1` with the new deployment ID.
- **Frontend & Environment Configuration**:
  - Updated `.env`, `web/.env.example`, and `web/src/services/api.js` with the new CSV export and Web App `/exec` URLs.
  - Updated `web/src/components/ItemCard.vue` to map single `Link Foto` directly to product card images and filter `#`, `No`, `Nomor` from extra properties.
  - Built web production bundle (`npm run build` completed cleanly in 1.43s).

---

## [GAS v2.0 Rewrite: On-Sheet Automation, Stock Cards & User Badges] - 2026-09-17
### Completed
- **Clean Codebase Rewrite (`GAS/`)**:
  - Deleted legacy backend files (`Auth.js`, `Controller.js`, `DriveService.js`, `SheetService.js`, `index.html`) in favor of purpose-built, on-sheet automation and card printing modules.
  - Built `Config.js`: Environment-backed configuration referencing `1_HvmBaEqFpOCBPXJuI4eMbhsKIDe5RhOrHo7h2kqt2c`, Drive Folder, and KPMscript Logo ID (`1UWZKajgW8l1vJX7pTL8kYuF7A6tprIjT`).
  - Built `Code.js`: Master menu `📦 Smart Warehouse` with openers for Single/Group Card print dialogs, User QR badge dialog, Fix Format, and Sync automations.
  - Built `Automation.js`: Real-time `onEdit` trigger for auto `No` assignment on row entries, auto `Link Foto` hyperlinking, and Drive image detection matching `Kode Material`. Added batch `syncNoAndLinks()` utility.
  - Built `FixFormat.js`: Sheet standardization utility repairing title banner, row 5 headers (`#1A237E`), alternating zebra rows, thin borders, alignments, and optimal column widths.
  - Built `UserService.js`: Initializes `User` sheet with `Admin`, `User`, and `IIT` accounts (`@gudang.local`) and auto-generates live QR code login formulas.
  - Built `PrintCardService.js` & `PrintCardModal.html`: Print-first engine strictly implementing the `Tcard` physical specifications:
    - **Single Card (4/A4, 2x2 grid, 90×110mm)**: Barcode CODE128, hole punch indicator, diagonal cut guidelines, 15 ledger rows, with automatic blank template cards filling remaining slots when 1 item is chosen.
    - **Group Card (2/A4, Half A4 / A5 stacked)**: Group QR code, hole punch indicator, and 15 group material lines, with blank duplicate template filling the second slot.
  - Built `PrintUserQR.html`: ID badge cards for `Admin`, `User`, and `IIT` with auto-generated QR code for scanner login.
- **Deployment**:
  - Successfully pushed 9 files to Google Apps Script via `@google/clasp push --force`.
  - Created immutable Version 4 and redeployed active deployment `AKfycbwlF3YI9-Npgr0MaL9M_ZtYC7MCQP2AWG9qzJ77cFHsM9X0O3dbnpP-wfIJTpGybeT7` (@4).

---

## [GAS v2.2: Exact Tcard Physical Reference Alignment] - 2026-09-17
### Completed
- **Pixel-Perfect Tcard Implementation (`GAS/PrintCardModal.html`)**:
  - **Single Item Card (`KARTU STOCK MATERIAL`)**:
    - Layout: 4 cards per A4 page (2×2 grid, 96×138mm boxes with 1.5mm cutting gap).
    - Chamfered Corner Cut Guides: 45° SVG dashed diagonal guides (`diagonal upr to btl` on top-left, `diagonal upl to btr` on top-right) for rack hanging trims.
    - Hole Punch Center Mark: Precise 6mm dashed circle guide with `HOLE` label.
    - Barcode: Compact CODE128 vector barcode via JsBarcode with Roboto Mono font.
    - Exact Meta Labels: `Kode Material :`, `Deskription :`, `Location :`.
    - Ledger Table: 15 rows (`No`, `Date`, `Good Moving`, `Mutasi`, `Stock`, `Note`) with `#E0E0E0` bold headers and solid borders.
    - Multi-mode Layout Selector:
      1. `1 Kartu + 3 Blank Template (Tcard Default)`: Prints selected item in slot 1 and fills slots 2–4 with blank writable templates.
      2. `4x Duplikat Material`: Fills all 4 slots with the selected material.
      3. `4 Material Berurutan`: Prints 4 sequential items starting from the selected material.
  - **Group Card (`KARTU STOCK MATERIAL Group`)**:
    - Layout: Half A4 (A5 size, 2 cards per A4 page stacked vertically).
    - Top Header: Base64 Logo + Center Hole punch guide + Group QR code (`GROUP:<groupName>`).
    - Exact Meta Labels: `Kode Group :`, `Deskription :`.
    - Ledger Table: 15 material rows (`No`, `Komat`, `Name`, `Mutasi`, `Stock`).
    - Multi-mode Layout Selector:
      1. `1 Group + 1 Blank Template (Tcard Default)`: Prints selected group in slot 1 and a blank group template in slot 2.
      2. `2x Duplikat Group`: Fills both slots with the selected group card.
- **Concealed IT Account & Dynamic User Management**:
  - Automatically hides IIT/IT rows in Google Sheets via `sheet.hideRows()`.
  - Filters out IIT/IT accounts completely from the User ID Badge dialog (`PrintUserQR.html`).
  - Enables dynamic user addition and single-account badge selection.
- **Deployment**:
  - Pushed all 9 files to Google Apps Script via `@google/clasp push --force`.
  - Created version 6 and redeployed active deployment `AKfycbwlF3YI9-Npgr0MaL9M_ZtYC7MCQP2AWG9qzJ77cFHsM9X0O3dbnpP-wfIJTpGybeT7` (@6).

---

## [GAS v2.3: Official REKA INKA Group Logo Integration] - 2026-09-17
### Completed
- **Replaced School Logo with Company Logo**:
  - Identified that the previous logo ID (`1UWZKajgW8l1vJX7pTL8kYuF7A6tprIjT`) was the SMKN 1 Madiun school emblem from `About.gs`.
  - Replaced it with the official **PT REKAINDO GLOBAL JASA (REKA INKA Group)** company logo from `KPMscript` (`ptrekaindo.co.id/wp-content/uploads/2024/07/logo-fix-1.png`).
- **Logo Delivery Engine (`GAS/LogoUri.js` & `GAS/PrintCardService.js`)**:
  - Built `LogoUri.js` with a high-resolution, lightweight 30KB optimized Base64 data URI for instant rendering.
  - Implemented 3-layer logo hierarchy:
    1. Checks if an image is pasted directly on the `Tcard` tab via `tcardSheet.getImages()`.
    2. Uses the official REKA INKA Group vector/bitmap logo (`REKAINDO_LOGO_DATA_URI`).
    3. Fallback to Google Drive `LOGO_ID`.
- **Layout & Dimension Polish**:
  - Widened logo containers in `PrintCardModal.html` (32mm single card, 46mm group card) and `PrintUserQR.html` (32mm badge) to preserve the 3:1 logo aspect ratio cleanly.
  - Updated fallback brand text from `LOGOKPM` to `REKA INKA`.
- **Deployment**:
  - Pushed 10 files to Google Apps Script via `@google/clasp push --force`.
  - Created version 7 and redeployed active deployment `AKfycbwlF3YI9-Npgr0MaL9M_ZtYC7MCQP2AWG9qzJ77cFHsM9X0O3dbnpP-wfIJTpGybeT7` (@7).









