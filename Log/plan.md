# Master Plan: Modernization & Architecture Migration

## 1. Overview
This project is transitioning from a monolithic Python Streamlit application (`app.py`) to a decoupled, production-grade architecture:
- **Backend / Cloud Layer:** Google Apps Script (GAS) acting as the serverless API interfacing with Google Sheets & Google Drive.
- **Frontend / Application Layer:** Containerized modern web application (Vue 3 / Vite) running via Docker.

---

## 2. Three Major Phases

```mermaid
graph TD
    subgraph Phase 1: Reorganize & Breakdown
        A1[Breakdown GAS Kode.js into modular services] --> A2[Establish Log & Documentation Standards]
        A2 --> A3[Decompose monolithic logic into clean modules]
    end
    subgraph Phase 2: Migration
        B1[Design Dockerized Web Stack: Vue + Node] --> B2[Implement API Gateway & Endpoints]
        B2 --> B3[Deprecate Streamlit frontend]
    end
    subgraph Phase 3: Optimization & Improvement
        C1[GAS Concurrency LockService & Dynamic Headers] --> C2[Direct Client-side Image Rendering & Canvas Merge]
        C2 --> C3[Security Token Authentication & Production Docker Builds]
    end
    Phase 1 --> Phase 2 --> Phase 3
```

### Phase 1: Reorganize & Breakdown (Current Focus: GAS)
1. **GAS Decomposition**:
   - `Config.js`: Centralized IDs, environment parameters, API security keys.
   - `Auth.js`: Request verification and API token security.
   - `DriveService.js`: Photo upload, blob conversion, folder management, sharing permissions.
   - `SheetService.js`: Dynamic header mapping (no hardcoded column numbers), row searches, additions, and updates.
   - `Controller.js`: Entry points (`doGet`, `doPost`), payload parsing, and standardized JSON responses.
2. **Repository Reorganization**:
   - Create documentation and audit logs in `Log/`.
   - Separate configuration from execution code.

### Phase 2: Migration (Streamlit -> Dockerized Web App)
1. **Frontend**:
   - Build a lightweight, responsive Vue 3 (or Vite) client.
   - Replicate the card-based Stock Opname interface, search engine, and inline editing workflows.
2. **Containerization**:
   - Create `Dockerfile` and `docker-compose.yml` for zero-configuration, reproducible local and server deployments.
3. **Backend Bridge**:
   - Node.js lightweight API or direct client-to-GAS secure communication.

### Phase 3: Optimization & Warehouse Intelligence (Current Target)
1. **Real-time Live Synchronization (0-Second Delay)**:
   - Google Apps Script `doGet` serving live JSON inventory directly from sheet, eliminating Google CSV caching latency.
2. **Dynamic User Management in Google Sheets**:
   - Store and manage authorized user accounts directly in a dedicated `"Users"` sheet in Google Spreadsheets, verified via Apps Script API.
3. **Integrated Camera Barcode & QR Scanner**:
   - Fast HTML5 camera scanner to locate items on warehouse racks and auto-fill material codes during new item intake.
4. **Offline Resilience & PWA (Progressive Web App)**:
   - Installable web app manifest and local storage caching for uninterrupted stock opname in warehouse Wi-Fi dead zones.
5. **1-Click Audit Reporting & Export**:
   - Instant CSV / Excel export of filtered search results and opname counts for inventory reconciliation.

