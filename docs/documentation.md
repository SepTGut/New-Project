# System Technical Documentation

## 1. Architecture Overview
The system facilitates **Stock Opname** (warehouse inventory tracking, registration, counting, and photo documentation).

### Components:
1. **Google Apps Script (GAS) Backend:**
   - Deployed as a Web App with `doGet` and `doPost` handlers.
   - Interacts with **Google Sheets** (storage for material code, location, quantity, UoM, description, photo URLs).
   - Interacts with **Google Drive** (storage for raw and merged JPEG photos).
2. **Client Application (Current: Streamlit; Target: Dockerized Vue/Node):**
   - User authentication and role-based access control (`admin`, `staff`).
   - Real-time or cached inventory search with whitespace and hyphen normalization.
   - Photo capture, client-side compression, and image merging.
   - Form submission to GAS Web App endpoint.

---

## 2. Google Apps Script API Specification

### Endpoint:
`POST <APPS_SCRIPT_URL>/exec`

### Headers:
- `Content-Type: application/json`

### Actions:

#### 1. `add` (Create Item)
**Request Payload:**
```json
{
  "action": "add",
  "apiKey": "optional-secret-key",
  "lokasiRak": "A-01-02",
  "kodeMaterial": "MAT-1002",
  "namaBarang": "Bearing 6204",
  "qty": 15,
  "uom": "PCS",
  "deskripsi": "Motor shaft bearing",
  "foto1": {
    "base64": "<base64-encoded-string>",
    "mimeType": "image/jpeg",
    "fileName": "foto1.jpg"
  },
  "foto2": null,
  "fotoGabungan": null
}
```

**Success Response:**
```json
{
  "success": true,
  "message": "Data berhasil disimpan!",
  "data": { "kodeMaterial": "MAT-1002", "rowIndex": 12 }
}
```

#### 2. `update` (Update Item)
**Request Payload:**
```json
{
  "action": "update",
  "apiKey": "optional-secret-key",
  "kodeMaterialAsli": "MAT-1002",
  "lokasiRak": "A-01-03",
  "kodeMaterial": "MAT-1002",
  "namaBarang": "Bearing 6204",
  "qty": 20,
  "uom": "PCS",
  "deskripsi": "Updated location",
  "foto1": null,
  "foto2": null,
  "keepFoto1": true,
  "keepFoto2": true,
  "fotoGabungan": null,
  "keepFotoGabungan": true
}
```

---

## 3. Data Schema (Google Sheet: `PictFinder`)
| Column Index (Logical) | Column Name | Description |
|---|---|---|
| 1 | `Lokasi Rak` | Shelf / warehouse rack location |
| 2 | `Kode Material` | Unique material code (Primary Key) |
| 3 | `Nama Barang` | Item title / name |
| 4 | `Qty` | Physical stock count |
| 5 | `UoM` | Unit of measurement (PCS, BOX, SET, etc.) |
| 6 | `Deskripsi` | Detailed notes |
| 7 | `Foto 1` | Google Drive URL for primary photo |
| 8 | `Foto 2` | Google Drive URL for secondary photo |
| 9 | `Foto Gabungan` | Google Drive URL for merged side-by-side composite photo |
