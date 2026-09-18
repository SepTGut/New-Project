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





