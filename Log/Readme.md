# Stock Opname Management System

A warehouse inventory tracking and stock opname platform integrating Google Sheets, Google Drive, and modern web interfaces.

---

## 📁 Repository Structure
```
├── .streamlit/             # Streamlit local configurations and secrets
├── GAS/                    # Google Apps Script codebase (clasp-managed)
│   ├── Config.js           # Environment constants, IDs, and API settings
│   ├── Auth.js             # API token security checks
│   ├── DriveService.js     # Image upload and Google Drive management
│   ├── SheetService.js     # Sheet search, dynamic columns, LockService writes
│   ├── Controller.js       # Web app handlers (doGet, doPost)
│   ├── appsscript.json     # Apps Script project manifest
│   └── index.html          # Standalone lightweight input form
├── Log/                    # Project documentation, migration plans, and PR logs
│   ├── plan.md             # 3-step master migration & modernization plan
│   ├── documentation.md    # Architecture and API specifications
│   ├── Readme.md           # Project guide and overview
│   ├── change.md           # Detailed changelog and tracking
│   └── PR.md               # Pull request & release notes
├── web/                    # Modern Vue 3 + Vite containerized web client
│   ├── src/
│   │   ├── assets/style.css# Glassmorphic dark design system
│   │   ├── components/     # Vue components (LoginForm, SearchBar, ItemCard, AddItemForm)
│   │   ├── services/       # API and Auth client services
│   │   └── utils/          # Canvas image compression & photo stitching
│   ├── Dockerfile          # Production multi-stage container build
│   └── nginx.conf          # Nginx SPA router & asset cache
├── docker-compose.yml      # Container orchestration
├── app.py                  # Python Streamlit application (Legacy / Baseline)
├── requirements.txt        # Python dependencies
└── .env                    # Local environment variables
```

---

## 🛠️ Quickstart

### 1. Running the Modern Web App (Vue 3 + Vite)
```powershell
cd d:\MyCode\New-Project\web
npm install
npm run dev
```
* The app runs at `http://localhost:5173`.
* **Admin Login:** `admin` / `admin123`
* **Staff Login:** `staff` / `staff123`

### 2. Running via Docker Container
When Docker Desktop is active:
```powershell
cd d:\MyCode\New-Project
docker compose up --build
```
* Accessible on port 3000: `http://localhost:3000`.

### 3. Syncing & Redeploying Google Apps Script
Whenever you modify files in `GAS/`, run the automated sync and deploy script to push code and update the active deployment version in one command:
```powershell
cd d:\MyCode\New-Project\GAS
.\sync_and_deploy.ps1
```
Or manually:
```powershell
clasp push
clasp version "Version Description"
clasp deploy -i AKfycbxCEJ02WRuoQ3Ja-IMlc28DzUx6DoNLHTnTWty1SSVQyTkCvgZoUksylTPbTd-sOeHl -V <version_number>
```

### 4. Running Python Streamlit (Legacy Baseline)
```powershell
pip install -r requirements.txt
streamlit run app.py
```

