# Changelog & Update Records

All notable changes and architectural transitions are documented in this file.

---

## [Comprehensive Code Review, Update Action, & Dual Auth Sync] - 2026-09-21
### Completed
- **Google Apps Script (`GAS/Code.js`, `GAS/UserService.js`)**:
  - **Implemented `action === 'update'` Endpoint**: Resolved missing update action in Google Apps Script that previously prevented item edits from `ItemCard.vue`.
  - **Conflict Prevention**: Validated unique `Kode Material` before saving edits to prevent overwriting existing material codes.
  - **Google Drive Photo Uploads**: Added `saveBase64ImageToDrive` supporting Base64 data URLs for both Foto 1 and Foto 2, saving directly into `CONFIG.DRIVE_FOLDER_ID`.
  - **Hyperlink Formula Concatenation**: Formula in `Link Foto` cell formatted with Indonesian Google Sheets semicolon delimiter: `=HYPERLINK("url1"; "Foto 1") & ", " & HYPERLINK("url2"; "Foto 2")`.
  - **Drive Photo Renaming on Code Change**: Added `renameDrivePhotoByCode` to automatically rename existing Google Drive photo files when `Kode Material` is updated.
  - **Real-Time JSON Inventory (`action === 'inventory'`)**: Added live inventory endpoint returning all items directly as JSON for 0-second real-time sync.
  - **Dual Password Authentication**: Added `computeSha256` in `UserService.js` using `Utilities.computeDigest` to verify both plain text passwords (used by WhatsApp Bot) and SHA-256 hashes (used by Vue 3 Web App).
  - **Apps Script Deployment**: Deployed Version 29 to active deployment ID `AKfycbyLDBXj86JNfidv5tgnryVygaEsbsuPePuOtVN7O2iYA4DE8dR2In5j2xfuuWU3AGOK`.
- **Vue 3 Web App (`web/`)**:
  - `web/src/components/ItemCard.vue`:
    - Enhanced `kodeMaterial` computed property so empty or `'-'` values automatically fall back to `ITEM-${item.No || item.no}`.
    - Pre-populated `editData.kodeMaterial` properly when opening the inline edit form.
    - Updated `handleSaveEdit` to pass both `kodeMaterialAsli` and `no` for exact row matching in Google Sheets.
  - `web/src/services/api.js`:
    - Updated `authenticateViaApi` signature and payload to pass `password` alongside `passwordHash`.
  - `web/src/services/auth.js`:
    - Synchronized `login` to pass both plain password and SHA-256 hash.
    - Normalized role mapping so Google Sheets accounts (`Admin`, `User`, `Staff`) map cleanly to `'admin'` or `'staff'`.
    - Added `user1` account hash to `DEFAULT_USERS` for complete offline and development fallback parity.
- **Container Build & Live Browser Verification**:
  - Rebuilt production assets with `npm run build` in 3.96s.
  - Rebuilt and restarted `stock_opname_app` container via Podman.
  - Verified full UI flow in browser subagent on WSL2 endpoint (`http://172.22.249.94:3000/`): all 64 items rendered, `ITEM-1` through `ITEM-64` badges display cleanly, and inline edit modal pre-populates all fields.

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

---

## [GAS v2.4: Locked Logo 1UWZKajgW8l1vJX7pTL8kYuF7A6tprIjT] - 2026-09-17
### Completed
- **Locked Target Logo to Drive ID `1UWZKajgW8l1vJX7pTL8kYuF7A6tprIjT`**:
  - Verified and confirmed user requirement to use Drive ID `1UWZKajgW8l1vJX7pTL8kYuF7A6tprIjT`.
  - Embedded as high-resolution optimized Base64 data URI in `GAS/LogoUri.js` (`TARGET_LOGO_DATA_URI`).
  - Added direct URL fallback `<img src="https://drive.google.com/uc?id=1UWZKajgW8l1vJX7pTL8kYuF7A6tprIjT">` in `PrintCardModal.html` and `PrintUserQR.html` so it always displays without ever falling back to blank or text.
  - Adjusted logo container dimensions (25×16 mm on Single Card, 32×20 mm on Group Card) for portrait shield layout.
- **Deployment**:
  - Pushed 10 files to Google Apps Script via `@google/clasp push --force`.
  - Created version 8 and redeployed active deployment `AKfycbwlF3YI9-Npgr0MaL9M_ZtYC7MCQP2AWG9qzJ77cFHsM9X0O3dbnpP-wfIJTpGybeT7` (@8).

---

## [GAS v2.5: Server-Side Template & Embedded Logo Delivery] - 2026-09-17
### Fixed
- **Instant Server-Side Template Evaluation**:
  - Upgraded `openSingleCardDialog()`, `openGroupCardDialog()`, and `openUserQRDialog()` from static `HtmlService.createHtmlOutputFromFile` to dynamic `HtmlService.createTemplateFromFile()`.
  - Injected `logoUri` and `initialMode` server-side before the dialog is rendered, eliminating the visual delay and blank modal state while `google.script.run` executes.
- **Permanent Drive Hotlink Immunity**:
  - Eliminated `https://drive.google.com/uc?id=...` fallback URLs which are blocked by modern browsers (403 Forbidden / Opaque Response Blocking).
  - Embedded `DEFAULT_LOGO_DATA_URI` directly inside `PrintCardModal.html` and `PrintUserQR.html` client scripts so the logo is 100% immune to network errors, permission issues, or RPC serialization failures.
- **Resolved ES6 Temporal Dead Zone (TDZ) in Apps Script**:
  - Converted `const TARGET_LOGO_DATA_URI` in `GAS/LogoUri.js` to `var TARGET_LOGO_DATA_URI` and added hoisted `function getTargetLogoDataUri()`.
  - Wrapped `PrintCardService.getLogoDataUri()` with defensive try-catch and hoisted function dispatch.
- **Robust RPC Error Handling**:
  - Added `.withFailureHandler()` to all client-side `google.script.run` invocations.
- **Deployment**:
  - Pushed 10 files to Google Apps Script via `@google/clasp push --force`.
  - Created version 9 and deployed to active deployment `AKfycbwlF3YI9-Npgr0MaL9M_ZtYC7MCQP2AWG9qzJ77cFHsM9X0O3dbnpP-wfIJTpGybeT7` (@9).

---

## [GAS v2.6: Simplified Print Form & Dynamic A4 Sheet Normalization] - 2026-09-17
### Added & Improved
- **Simplified Number/Range Selector for Single Items**:
  - Replaced clumsy material dropdowns and multi-mode layout selectors with a clean range input (e.g. `1`, `1-2`, `1-4`, `1,3`, `1-5`).
  - Implemented automatic normalization onto A4 sheets:
    - 4 card slots per A4 page.
    - Selecting `1` prints 1 chosen card + 3 blank duplicate templates on 1 A4 sheet.
    - Selecting `1-2` prints 2 chosen cards + 2 blank duplicate templates on 1 A4 sheet.
    - Selecting `1-5` automatically creates 2 A4 sheets (Sheet 1: 4 cards, Sheet 2: 1 card + 3 blanks).
- **Simplified Group Range Selector**:
  - Supports entering group identifiers such as `1-2`, `A-B`, `1,3`, or `A,D`.
  - Normalizes onto A4 sheets (2 cards per A4 sheet, A5 half-page):
    - Selecting `A` or `1` prints 1 group card + 1 blank group template on 1 A4 sheet.
    - Selecting `A-B` or `1-2` prints 2 group cards on 1 A4 sheet.
    - Selecting 3 groups automatically creates 2 A4 sheets (Sheet 1: 2 groups, Sheet 2: 1 group + 1 blank).
- **Multi-Sheet DOM & Clean Print Pagination**:
  - Replaced single static sheet with dynamic `#pagesContainer` generating `<div class="a4-sheet">` for each required page with CSS page-break rules.
- **Pre-seeded Active Row Detection**:
  - Opening the modal from the spreadsheet automatically detects the current selected row number or group and pre-populates the input.
- **Deployment**:
  - Pushed 10 files to Google Apps Script via `@google/clasp push --force`.
  - Created version 10 and deployed to active deployment `AKfycbwlF3YI9-Npgr0MaL9M_ZtYC7MCQP2AWG9qzJ77cFHsM9X0O3dbnpP-wfIJTpGybeT7` (@10).

---

## [GAS v2.7: Hotfix Syntax Error in PrintCardModal.html] - 2026-09-17
### Fixed
- Removed accidental `[diff_block_end]` token and restored properly closed callback block in `PrintCardModal.html`.
- Verified 100% clean Node.js syntax parsing on all scripts and client-side modal code.
- **Deployment**:
  - Pushed 10 files to Google Apps Script via `@google/clasp push --force`.
  - Created version 11 and deployed to active deployment `AKfycbwlF3YI9-Npgr0MaL9M_ZtYC7MCQP2AWG9qzJ77cFHsM9X0O3dbnpP-wfIJTpGybeT7` (@11).

---

## [GAS v2.8: KPMscript Pattern Native Prompt & Server-Rendered Print View] - 2026-09-17
### Architectural Transition to KPMscript Pattern
- **Eliminated Complex HTML Form Modals**:
  - Removed all interactive form inputs, dropdowns, mode-switch buttons, chips, and asynchronous `google.script.run` client-server RPCs from the modal dialog.
  - Replaced the input step with native Google Sheets `ui.prompt()` message boxes, mirroring the battle-tested `printKpmM` architecture from `KPMscript`.
- **Native Prompt Selection**:
  - **Single Item Cards**: User clicks menu -> native Google Sheets prompt appears with active item number pre-filled. User can enter `1`, `1-2`, `1,3`, `1-5`.
  - **Group Cards**: User clicks menu -> native Google Sheets prompt appears with active group name pre-filled. User can enter `1`, `A`, `1-2`, `A-B`, `1,3`, `A,D`.
- **Server-Side Normalization**:
  - Automatically calculates and normalizes cards to complete A4 pages on the server:
    - Single mode: multiples of 4 cards per A4 page (e.g. 1 item -> 1 card + 3 blanks; 5 items -> 5 cards + 3 blanks across 2 A4 pages).
    - Group mode: multiples of 2 cards per A4 page (e.g. 1 group -> 1 group + 1 blank; 2 groups -> 2 groups on 1 A4 page).
- **Pure Server-Rendered Print Preview (`PrintCardModal.html`)**:
  - Directly renders complete pages and cards using Apps Script server scriptlets, matching `PrintKPM.html`.
  - Clean top toolbar featuring **Cetak Sekarang (Print)** (`window.print()`) and **Tutup** (`google.script.host.close()`) with live badge summary.
  - Zero risk of JavaScript syntax/token errors as all barcode payloads are stored in HTML data attributes and evaluated cleanly.
- **Deployment**:
  - Pushed 10 files to Google Apps Script via `@google/clasp push --force`.
  - Created version 12 and deployed to active deployment `AKfycbwlF3YI9-Npgr0MaL9M_ZtYC7MCQP2AWG9qzJ77cFHsM9X0O3dbnpP-wfIJTpGybeT7` (@12).

---

## [GAS v3.1: Sheet Bug Detection, Auto Gap-Healing, 15-Item Group Cards & Bulletproof Logo Delivery] - 2026-09-17
### Identified Sheet & Architecture Issues
- **Sheet Numbering Gaps Identified (`PictFinder`)**:
  - Probing detected missing numbers at Row 9 (item 4 between 3 and 5) and Row 15 (item 10 between 9 and 11).
  - Row 1 Cell A1 of the `User` tab was blank (missing header title `'No'`).
- **Simple Trigger Permission Bottleneck**:
  - `Config.js` `getEnv()` was attempting `props.setProperty()`, which is prohibited in Google Apps Script unauthenticated simple triggers (`onEdit`) and throws authorization exceptions.
  - Made `getEnv()` strictly read-only with defensive try-catch.
- **Group Card 5-Row Chunking Bug**:
  - `PrintCardService.js` had `maxItemsPerCard = 5` instead of `15`. Because the physical Tcard Group ledger has 15 material rows, a group with 12 items was being unnecessarily chunked into 3 cards of 5 items each with 10 empty lines on each card.
  - Updated `maxItemsPerCard` to `15` so groups up to 15 items print cleanly on a single card.
- **Logo Delivery & Syntax Safety**:
  - Added KPMscript's inline SVG badge as bulletproof fallback in `PrintCardService.getLogoDataUri()`.
  - Exposed both `data.logo` and `data.logoUrl` in all print datasets.
  - Replaced unescaped string injection in `PrintUserQR.html` with `<?= JSON.stringify(logoUri) ?>` to eliminate any risk of `SyntaxError: Invalid or unexpected token`.
- **Instant Numbering Gap-Healing**:
  - `handlePictFinderEdit` now scans all existing data rows on edit and automatically restores missing sequential numbers whenever any cell in the sheet is edited.
  - `fixFormat()` now repairs and standardizes both `PictFinder` and `User` sheet headers simultaneously.

### Deployment
- Pushed 10 files to Google Apps Script via `@google/clasp push --force`.

---

## [GAS v3.2: Replaced School Emblem with Official KPMscript REKAINDO Corporate Logo] - 2026-09-17
### Completed
- **Removed SMKN 1 School Logo**:
  - Completely removed the school emblem (Google Drive ID `1UWZKajgW8l1vJX7pTL8kYuF7A6tprIjT` from `About.gs`) from active configuration, templates, and fallbacks per explicit user instruction.
  - Cleared `LOGO_ID` default in `GAS/Config.js` (`getEnv('LOGO_ID', '')`) and in `initializeScriptProperties()` to ensure the project does not default to the school emblem.
  - Removed LH3 CDN `onerror` fallback targeting the school emblem from `GAS/PrintCardModal.html`.
- **Integrated Official PT REKAINDO GLOBAL JASA (REKA INKA Group) Corporate Logo**:
  - Restored the official high-resolution corporate logo (`REKAINDO_LOGO_DATA_URI`, 30KB optimized transparent PNG) used by KPMscript's print feature (`kpmprint` / `printKpmM` / `PrintKPM.html` / `Code.gs`) in `GAS/LogoUri.js`.
  - Added compatibility aliases `TARGET_LOGO_DATA_URI`, `getTargetLogoDataUri()`, and `getRekaindoLogoDataUri()`.
  - Updated `GAS/PrintCardService.js` `getLogoDataUri()` to prioritize the official REKA INKA Group logo, check for user-placed images on the `Tcard` tab, and use KPMscript's native vector SVG badge (`fill="#16233B"` with text `REKAINDO`) as the fallback instead of the SMKN 1 SVG.
- **Card & Modal Layout Adjustments**:
  - Adjusted logo container dimensions in `GAS/PrintCardModal.html` (32×16 mm on Single Card, 46×18 mm on Group Card) and `GAS/PrintUserQR.html` (32×12 mm on ID badges) with `object-fit: contain` to showcase the ~2.83:1 rectangular corporate brand.
  - Updated `GAS/PrintUserQR.html` `DEFAULT_LOGO_DATA_URI` to use the REKA INKA Group logo.
- **Verification & Deployment**:
  - Verified compilation of all 7 JavaScript modules with Node.js (`node -c`).
  - Simulated `getLogoDataUri()` in Node.js VM confirming exact dimensions (600×212) and 30,188-byte PNG buffer.
  - Pushed all 10 project files to Google Apps Script via `@google/clasp push --force`.
  - Created version 17 and updated active deployment `AKfycbyLDBXj86JNfidv5tgnryVygaEsbsuPePuOtVN7O2iYA4DE8dR2In5j2xfuuWU3AGOK` (@17).

---

## [GAS v3.3: Resolved IDE Scriptlet Syntax Diagnostics in PrintUserQR.html] - 2026-09-18
### Identified Problem
- In `GAS/PrintUserQR.html`, line 232 had `let appLogo = <?= JSON.stringify(logoUri || '') ?>;` directly inside the `<script>` tag.
- Client-side IDE language servers (VS Code / Antigravity IDE) parse `<script>` blocks strictly as JavaScript/TypeScript, triggering five `Expression expected` syntax errors on the `<` template delimiter.

### Solution & Changes
- **Decoupled Server Template Scriptlet from Client JavaScript**:
  - Extracted the server template scriptlet into an HTML carrier data attribute immediately before the `<script>` tag:
    ```html
    <div id="initialLogoData" data-logo="<?= encodeURIComponent(logoUri || '') ?>" style="display:none;"></div>
    ```
  - Replaced the inline scriptlet assignment in the `<script>` tag with pure, valid JavaScript:
    ```javascript
    let allUsers = [];
    let appLogo = DEFAULT_LOGO_DATA_URI;
    try {
      const initLogoEl = document.getElementById('initialLogoData');
      if (initLogoEl && initLogoEl.getAttribute('data-logo')) {
        const decodedLogo = decodeURIComponent(initLogoEl.getAttribute('data-logo'));
        if (decodedLogo && decodedLogo.length > 10 && decodedLogo.indexOf('<?') !== 0) {
          appLogo = decodedLogo;
        }
      }
    } catch (e) {}
    ```
  - Preserved the client-side asynchronous update in `window.onload` via `getUserQRModalData()`, which dynamically loads `data.logoUri` and refreshes user badges.
- **Diagnostics Verification**:
  - Zero syntax errors or IDE diagnostics in `GAS/PrintUserQR.html`.
- **Deployment**:
  - Pushed all 10 files to Google Apps Script via `@google/clasp push --force`.
  - Created version 18 and deployed to active deployment `AKfycbyLDBXj86JNfidv5tgnryVygaEsbsuPePuOtVN7O2iYA4DE8dR2In5j2xfuuWU3AGOK` (@18).

---

## [GAS v3.4: Removed Group Card Printing Feature & Section] - 2026-09-18
### Removed Components
- **Spreadsheet Menu (`GAS/Code.js`)**:
  - Removed `'📦 Cetak Kartu Group (Group - 2/A4)'` from the `📦 Smart Warehouse` menu in `onOpen()`.
  - Renamed single card menu action to `'🏷️ Cetak Kartu Material (4/A4)'`.
  - Removed `openGroupCardDialog()` and deprecated `getGroupCardData()` wrapper.
  - Cleaned `getPrintModalInitialData()` by removing group scanning.
- **Service Layer (`GAS/PrintCardService.js`)**:
  - Removed `promptAndPrintGroup()`, `buildGroupPrintData()`, `getAllGroupsData()`, `getAllGroupsList()`, and `parseGroupRange()`.
  - Updated `promptAndPrintSingle()` and `buildSinglePrintData()` title to `'Cetak Kartu Material (4/A4)'`.
- **Print Modal Template (`GAS/PrintCardModal.html`)**:
  - Deleted the entire Group Card rendering section (`<div class="grid-group-2"> ... </div>`, 15-item group ledger table, and QR code).
  - Cleaned up CSS: removed `.grid-group-2`, `.card-group-box`, `.group-cut-divider`, `.table-group-ledger`, and `.card-group-box .logo-container`.
  - Updated toolbar mode badge to `'🏷️ KARTU MATERIAL (4/A4)'`.
  - Simplified `#pagesContainer` to render material cards directly without branching logic.

### Deployment
- Pushed all 10 files to Google Apps Script via `@google/clasp push --force`.
- Created **Version 19** and deployed to active deployment `AKfycbyLDBXj86JNfidv5tgnryVygaEsbsuPePuOtVN7O2iYA4DE8dR2In5j2xfuuWU3AGOK` (@19).

---

## [GAS v3.5: Exported 64 Material Items & 8-Column Warehouse Synchronization] - 2026-09-18
### Completed Data Export
- **Exported All 64 Items from Source Spreadsheet** (`https://docs.google.com/spreadsheets/d/1SyeWtAjKAFyDs8oDVxKhiQluF45JjB_Se79PjmfrQxQ/edit?gid=0#gid=0`):
  - [data/exported_source_inventory.csv](file:///d:/MyCode/New-Project/data/exported_source_inventory.csv): UTF-8 BOM CSV mapped directly to warehouse columns (`No`, `Lokasi Rak`, `Kode Material`, `Nama Barang`, `Qty`, `UoM`, `Deskripsi`, `Link Foto`).
  - [data/exported_source_inventory.json](file:///d:/MyCode/New-Project/data/exported_source_inventory.json): Full structured JSON dataset with item metadata and photo drive URLs.
  - [data/source_raw.csv](file:///d:/MyCode/New-Project/data/source_raw.csv): 1-to-1 exact raw replica of the source sheet.

### One-Click In-App Import Feature
- Added `importFromSourceSheet()` in `GAS/Code.js` with menu item:
  - `📥 Salin Data dari Sheet Sumber (64 Item)` in `📦 Smart Warehouse`.
  - Automatically fetches the source CSV via `UrlFetchApp`, parses all 64 items, populates `PictFinder` starting at row 3 with auto-hyperlinked photos, sequential numbering, and standardized styling.

### Standardized 8-Column Schema
- Aligned `GAS/Config.js`, `GAS/FixFormat.js`, `GAS/Automation.js`, and `GAS/PrintCardService.js` to match the exact 8-column layout of the live sheet:
  - `HEADER_ROW`: 2
  - `DATA_START_ROW`: 3
  - Columns: `NO (1)`, `LOKASI_RAK (2)`, `KODE_MATERIAL (3)`, `NAMA_BARANG (4)`, `QTY (5)`, `UOM (6)`, `DESKRIPSI (7)`, `LINK_FOTO (8)`.

### Deployment
- Pushed all 10 files to Google Apps Script via `@google/clasp push --force`.
- Created **Version 20** and deployed to active deployment `AKfycbyLDBXj86JNfidv5tgnryVygaEsbsuPePuOtVN7O2iYA4DE8dR2In5j2xfuuWU3AGOK` (@20).

---

## [GAS v3.6: Row Layout Correction - Data Starts from Row 6] - 2026-09-18
### Changes
- **Updated Sheet Row Geometry**:
  - `CONFIG.HEADER_ROW`: Set to Row 5.
  - `CONFIG.DATA_START_ROW`: Set to Row 6 (data rows now start from Row 6 onward).
  - Rows 1 to 3: Title banner (`Stock Opname Gudang`).
  - Row 4: Spacer row.
  - Row 5: Column headers (`No`, `Lokasi Rak`, `Kode Material`, `Nama Barang`, `Qty`, `UoM`, `Deskripsi`, `Link Foto`).
  - Row 6+: Inventory data records.
- **Updated Components**:
  - `GAS/Config.js`: Configured `HEADER_ROW = 5` and `DATA_START_ROW = 6`.
  - `GAS/FixFormat.js`: Formats rows 1-3 as title banner, cleans row 4 spacer, formats row 5 as blue header, and applies zebra striping + numbering from row 6 down.
  - `GAS/Code.js`: `importFromSourceSheet()` now inserts all 64 items starting at row 6.
  - `GAS/Automation.js`: Aligned edit listeners and gap auto-healing to row 6.
  - `GAS/PrintCardService.js`: Reads materials starting from row 6.

### Deployment
- Pushed all 10 files to Google Apps Script via `@google/clasp push --force`.
- Created **Version 21** and deployed to active deployment `AKfycbyLDBXj86JNfidv5tgnryVygaEsbsuPePuOtVN7O2iYA4DE8dR2In5j2xfuuWU3AGOK` (@21).

---

## [GAS v3.7: Fix Foto Link Formula Delimiter (Comma to Semicolon)] - 2026-09-21
### Changes
- **Formula Delimiter Alignment**:
  - Replaced comma (`,`) with semicolon (`;`) in `=HYPERLINK("url"; "Link")` across all Google Apps Script modules to match Google Sheets locale syntax requirement and eliminate formula parse errors (`#ERROR!`).
- **Auto-Healing for Existing Broken Formulas**:
  - `GAS/Automation.js`:
    - Updated `handlePictFinderEdit()` to write `=HYPERLINK("url"; "Link")` and auto-convert existing `,` delimited formulas on edit.
    - Updated `syncNoAndLinks()` to scan existing data rows and auto-repair any comma-delimited `=HYPERLINK` formulas into proper semicolon syntax.
  - `GAS/FixFormat.js`:
    - Added automatic formula delimiter repair inside `fixFormat()` so running "Rapikan Format Sheet (Fix Format)" instantly heals any broken foto link formulas.
  - `GAS/Code.js`:
    - Updated `importFromSourceSheet()` to insert `=HYPERLINK("url"; "Link")` with `;`.
### Deployment
- Pushed all 10 files to Google Apps Script via `clasp push`.
- Created **Version 22** and deployed to active deployment `AKfycbyLDBXj86JNfidv5tgnryVygaEsbsuPePuOtVN7O2iYA4DE8dR2In5j2xfuuWU3AGOK` (@22).

---

## [GAS v3.8: Dynamic Drive Logo Refactor (`getLogoSafe`) & Deleted LogoUri.js] - 2026-09-21
### Changes
- **Implemented `getLogoSafe()` Engine**:
  - Implemented standalone `getLogoSafe()` in `GAS/PrintCardService.js` that retrieves the logo file directly from Google Drive using `DriveApp.getFileById(logoId)`.
  - Converts the file blob to a Base64 data URI (`data:<contentType>;base64,<base64>`).
  - Integrated 6-hour `CacheService` (`APP_LOGO_<id>`) to eliminate redundant DriveApp calls and prevent rate limiting.
- **Support for Script Properties & Config Alias**:
  - Automatically retrieves `LOGO_ID` from Script Properties via `CONFIG.LOGO_ID` / `PRINT.LOGO_ID`.
  - Added `PRINT` configuration alias in `GAS/Config.js` (`PRINT.LOGO_ID -> CONFIG.LOGO_ID`).
  - Graceful fallback to default vector SVG badge if `LOGO_ID` is not yet configured, preventing print dialog crashes.
- **Repository Cleanup**:
  - Permanently deleted `GAS/LogoUri.js` (removed 40KB hardcoded Base64 payload).
  - Codebase streamlined to 9 modular files.
### Deployment
- Pushed 9 modular files to Google Apps Script via `clasp push`.
- Created **Version 23** and deployed to active deployment `AKfycbyLDBXj86JNfidv5tgnryVygaEsbsuPePuOtVN7O2iYA4DE8dR2In5j2xfuuWU3AGOK` (@23).

---

## [v4.0: Two-Way Interactive WhatsApp Bot & Podman Dual-Service Stack] - 2026-09-21
### Summary
Added complete WhatsApp compatibility to the Smart Warehouse system, consisting of a self-hosted two-way interactive WhatsApp Bot microservice (`wabot/`), enhanced Google Apps Script REST APIs, dual-container Podman orchestration, and a 1-click WhatsApp share feature in the web app.

### Key Changes
1. **WhatsApp Bot Microservice (`wabot/`)**:
   - Built on `@whiskeysockets/baileys` (native multi-device WhatsApp protocol) with zero SaaS subscription fees.
   - Built an Express web dashboard on port `3001` (`http://localhost:3001`) with:
     - Real-time connection status pill (Connected / Waiting for QR / Disconnected).
     - Live auto-refreshing QR Code pairing display.
     - Interactive bot command simulator / playground for testing commands without scanning.
     - Service telemetry & active sessions counter.
   - Enforced IPv4 resolution priority (`dns.setDefaultResultOrder('ipv4first')` + `httpAgent/httpsAgent`) to prevent WSL2/Docker IPv6 timeouts (`ENETUNREACH`).
   - Implemented in-memory caching for published CSV inventory to ensure sub-second response times.
   - Implemented full command handler in `wabot/src/handlers/messageHandler.js`:
     - `!menu` / `!help`: Comprehensive Indonesian command guide.
     - `!login <user> <pass>`: Verifies credentials against Google Sheets `User` tab.
     - `!logout`: Terminates active phone session.
     - `!status`: Shows login role and operator name.
     - `!cek <kode/nama>` / `!stok <kode/nama>`: Searches material, displays rack location, available qty, UoM, specification, and automatically fetches & attaches physical photos from Google Drive. Prioritizes exact matches.
     - `!opname <kode> <qty>`: Real-time physical inventory count update directly into Google Sheets (requires login).
     - `!tambah <rak>|<kode>|<nama>|<qty>|<uom>|<desk>`: Registers new material into Google Sheets (Admin only).

2. **Google Apps Script Backend Enhancements**:
   - Added `UserService.verifyUser(username, password)` in `GAS/UserService.js` to authenticate warehouse staff accounts while respecting hidden IT/IIT accounts.
   - Implemented `handleApiRequest(e)` in `GAS/Code.js` supporting actions:
     - `ping`: Health check.
     - `search`: Filtered item retrieval with Drive photo ID extraction.
     - `check`: Exact material lookup by code.
     - `login`: User credential verification.
     - `opname`: Direct Qty update by material code.
     - `add`: Sequential item insertion with automatic Drive photo hyperlink matching.
   - Deployed live updates to **Version 27** (`AKfycbxFzRD3yMRQ1FpCqnzx_J3WYiQ6wkI_CP5mfEZ6efy1j8ntMxGT4hy5rBvxHNvUUs8`).

3. **Web Application WhatsApp Sharing**:
   - Added **"💬 WA Share"** button on every inventory card in `web/src/components/ItemCard.vue`.
   - Formats material code, name, rack location, qty, and description into a pre-filled `https://wa.me/?text=...` deep-link.
   - Added `.btn-wa` styling with green accent matching modern WhatsApp brand guidelines in `web/src/assets/style.css`.

4. **Podman Container Orchestration**:
   - Updated `docker-compose.yml` with dual-container architecture:
     - `stock_opname_app` (port `3000:80`) - Production Nginx web server.
     - `stock_opname_wabot` (port `3001:3001`) - Node 20 WhatsApp bot service.
     - Persistent volume `wabot_auth` to retain QR pairing credentials across container reboots.
   - Verified both services running smoothly in Podman rootless WSL2 environment.

---

## [v4.1: Unified WhatsApp Bot & PPO Progress Reporting Integration] - 2026-09-21
### Summary
Merged the standalone PPO Job Progress Reporting bot (`ServerWAbotPPO`) into the primary Smart Warehouse WhatsApp bot service (`wabot/`), creating a **Single Unified WhatsApp Bot** for warehouse staff and PPO field technicians. Added dual local/cloud Excel persistence, an interactive multi-step reporting state machine, technical FAQ search, and an enhanced web dashboard with live report preview and 1-click Excel download.

### Key Changes
1. **Single Unified WhatsApp Bot Microservice (`wabot/`)**:
   - Eliminated the need to maintain two separate phone numbers, WhatsApp sessions, or isolated containers.
   - Unified Indonesian menu (`!menu` / `!help`) clearly presenting both operational modules:
     - **Modul 1 (Stock Opname Gudang)**: `!cek`, `!opname`, `!tambah`, `!login`, `!status`, `!logout`.
     - **Modul 2 (PPO Job Progress Reporting)**: `!lapor` (interactive 7-step guided workflow), `!faq <query>`, `batal`.
   - Ported and hardened PPO engine in `wabot/src/ppoService.js`:
     - Built-in offset parser (`{ range: 1, defval: null }`) and column fill-down resolver for `data-titik-lokasi.xlsx` supporting all 36 buildings, sub-jobs, and locations.
     - Cell-embedded photo reporting into local Excel (`data/ppo/laporan-progress.xlsx`) via `exceljs`, with automatic backup workbook generation via `xlsx`.
     - In-memory FAQ query engine and recent reports query resolver.
     - User session state persistence (`sesi-aktif.json`) with interactive 7-step state machine: Gedung -> Sub Pekerjaan -> Titik Lokasi -> Progres (%) -> Status -> Kendala -> Foto Dokumentasi.

2. **Web Dashboard & REST API (`:3001`)**:
   - **Recent Reports Table**: Real-time table displaying timestamp, reporter, building, sub-job, progress %, status, issues, and photo indicators.
   - **1-Click Excel Download**: Direct browser download button (`/api/reports/download`) to retrieve `laporan-progress.xlsx` instantly without terminal access.
   - **Interactive Web Simulator**: Updated with quick-command chips for both Warehouse Stock (`!cek ITEM-1`, `!opname ...`) and PPO Reporting (`!lapor`, `1`, `batal`, `!faq ac`).

3. **Podman Multi-Container Orchestration & Volumes**:
   - Updated `docker-compose.yml`:
     - Mounted host directory `./data/ppo:/app/data` with environment variable `DATA_DIR=/app/data`.
     - Ensured local Excel files (`./data/ppo/laporan-progress.xlsx`) and photos (`./data/ppo/foto-laporan/`) remain directly accessible and editable on the Windows host.
   - Preserved zero port conflicts by maintaining single dashboard port `3001` alongside Vue 3 app on `3000`.

---

## [v4.2: Universal Multi-Token Search & Direct WhatsApp Querying] - 2026-09-21
### Summary
Upgraded search intelligence across the entire ecosystem (WhatsApp Bot, Vue 3 Web Application, and Google Apps Script API). Users can now search by **anything** — material name, material code, rack location, item number, or description — with multi-token keyword splitting, order-independent matching, and direct query texting without requiring the `!cek` prefix.

### Key Changes
1. **WhatsApp Bot Direct Search (`wabot/`)**:
   - **Direct Plain Text Search**: Users can send plain messages (e.g. `wago`, `san disk 64`, `mcb abb`, `ITEM-1`, `baut m8`) without needing to type `!cek`. The bot automatically searches inventory and sends back the exact material card or a numbered list of matches.
   - **Multi-Token Scoring Engine (`dataService.js`)**:
     - Splits query into separate keywords (e.g. `wago 413` matches `Wago 769-413`; `RE02 wago` matches Wago items in rack `RE02.1`).
     - Normalizes punctuation, hyphens, and spaces so `ITEM 1`, `ITEM-1`, `item1`, and `#1` all resolve identically.
     - Ranks exact matches (`score: 100`) at the top, followed by prefix matches and multi-field combinations.
     - Automatically assigns `ITEM-${no}` fallback for items with blank/hyphen codes.

2. **Web Application Search (`web/src/App.vue`)**:
   - Upgraded `filteredItems` to universal multi-token search across all item fields.
   - Added helpful search suggestion chips (`Wago`, `MCB`, `San Disk`, `Relay`, `ITEM-1`, `Rak RE02.1`) in the initial state.
   - Added **"📦 Tampilkan Semua"** button allowing users to view the full inventory catalog with a single click.

3. **Google Apps Script Backend API (`GAS/Code.js`)**:
   - Updated `action=search` endpoint to use multi-token scanning across all 8 columns (`No`, `Lokasi Rak`, `Kode Material`, `Nama Barang`, `Qty`, `UoM`, `Deskripsi`, `Link Foto`).
   - Pushed via clasp and deployed as **Version 28** (`AKfycbwYQSEzqmij2rD00ITG_39csE3vARolrFFMRm2Xt11fkqYx85RBkvlNszhfEkaxaMvb`).

---

## [v4.3: Review, UI/UX Menu Polish, Excel Schema Repair & Multi-Machine Hardening] - 2026-09-22
### Summary
Completed comprehensive review and audit across the entire ecosystem. Redesigned the WhatsApp bot menu and quick-start tutorials with clean spacing and legibility. Resolved a 1-column shift in the PPO Excel report structure, upgraded the FAQ engine to a dual-engine system (operational SOP + 727 electrical material procurement items), fixed `/dashboard` routing in Express, removed UTF-8 BOM from `start.sh`, and updated the deployment bundle script.

### Key Changes
1. **WhatsApp Bot Menu & Quick-Start Tutorial Redesign (`messageHandler.js`)**:
   - **Spacious & Uncluttered Layout**: Completely eliminated crowded, wall-of-text formatting in favor of card-style whitespace, clean section dividers (`━━━━━━━━━━━━━━━━━━━━`), and action arrows (`➔`).
   - **Dedicated `!panduan` / `!tutorial`**: Added a comprehensive step-by-step walkthrough for first-time users covering item search, stock opname, 7-step PPO reporting, and troubleshooting.
   - **Modular Sub-Menus**: Added `!menu gudang` and `!menu ppo` for focused single-system operations.
   - **Visual Action Arrows**: Standardized syntax display so users can scan commands and examples effortlessly on mobile screens.

2. **PPO Excel Schema Repair & Alignment (`ppoService.js`, `laporan-progress.xlsx`)**:
   - **13-Column Schema Alignment**: Standardized `KOLOM_LAPORAN` across code and Excel: `['Waktu Input', 'Nomor Pengirim', 'Nama Pengirim', 'Gedung', 'Tanggal Pengerjaan', 'Jam Selesai', 'Sub Pekerjaan', 'Titik Lokasi', 'Progres', 'Status', 'Kendala', 'Nama File Foto', 'Foto']`.
   - **Eliminated Column Shift**: Repaired historic rows and updated row 1 headers in `data/ppo/laporan-progress.xlsx`, ensuring report data maps 1:1 with headers without shifting.
   - **Optimized Workbook Footprint**: Stripped corrupt/bloated temp objects from `laporan-progress.xlsx`, reducing file size from 4.8 MB to ~10 KB.

3. **Dual-Engine FAQ Search (`ppoService.js`)**:
   - **Engine 1 (Operational SOP)**: Built-in knowledge base answering frequent field questions (`!faq lapor`, `!faq foto`, `!faq kendala`, `!faq opname`, `!faq pembatalan`).
   - **Engine 2 (Procurement & Material Tracker)**: Multi-token search across the 727-row electrical procurement table in `data/ppo/faq.xlsx` (matching Description, SpecTech, Code, and Building to return PO status, arrival status, ETA, and BOM qty).

4. **Express Routing & Docker Environment Hardening (`server.js`, `docker-compose.yml`)**:
   - Added `/dashboard` route alias (`app.get(['/', '/dashboard'], ...)`), preventing 404 errors when navigating to the URL advertised in `README.md` and start scripts.
   - Fixed `start.sh` UTF-8 BOM (`\xef\xbb\xbf`) that caused bash interpreter errors on Linux/macOS.
   - Hardened `wabot/src/bot.js` Baileys session clearing (`clearAuthFolder()`) to avoid Docker volume mount locks (EBUSY).

5. **Web Application & Packaging Polish (`ItemCard.vue`, `bundle.ps1`)**:
   - Added `imgLoadFailed` state in `ItemCard.vue` to show a clean fallback placeholder ("Foto Tidak Dapat Dimuat") if an image fails to load.
   - Updated `bundle.ps1` to ensure `wabot\auth_info_baileys` folder structure exists even when `-NoAuth` is specified.
   - Re-generated deployable archive `smart-warehouse-bundle.zip`.


