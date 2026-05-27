# ChurnIQ — Panduan Setup MongoDB

## File yang Diganti

| File | Perubahan |
|------|-----------|
| `server.py` | Tambah pymongo, 4 route baru: `/data/save`, `/data/load`, `/data/delete`, `/data/status` |
| `common.js` | Ganti localStorage → MongoDB API. Init load dari MongoDB dulu, fallback ke localStorage |
| `common.css` | Tambah style tombol Delete Data + Delete Modal + tooltip hover untuk info icon |
| `index.html` | Tombol Delete Data di topbar, Delete Modal, tooltip `data-tooltip` di semua info icon |
| `atrisk.html` | Tombol Delete Data di topbar + Delete Modal |
| `segments.html` | Tombol Delete Data di topbar + Delete Modal |
| `predict.html` | Tombol Delete Data di topbar + Delete Modal |
| `requirements.txt` | Tambah `pymongo[srv]` |

---

## 1. Install Dependencies

```bash
pip install -r requirements.txt
```

---

## 2. Pilih Opsi MongoDB

### Opsi A — MongoDB Lokal (Development)

1. Install MongoDB Community: https://www.mongodb.com/try/download/community
2. Jalankan MongoDB service:
   ```bash
   # Windows
   net start MongoDB

   # macOS (Homebrew)
   brew services start mongodb-community

   # Linux
   sudo systemctl start mongod
   ```
3. URI default sudah `mongodb://localhost:27017` — tidak perlu set env var.

### Opsi B — MongoDB Atlas (Cloud, Gratis Tier M0)

1. Buat akun di https://cloud.mongodb.com
2. Buat cluster baru (pilih M0 Free Tier)
3. Buat database user (username + password)
4. Whitelist IP address kamu (atau `0.0.0.0/0` untuk dev)
5. Klik "Connect" → "Drivers" → copy connection string:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net
   ```
6. Set environment variable:
   ```bash
   # Windows PowerShell
   $env:MONGODB_URI = "mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net"

   # macOS / Linux
   export MONGODB_URI="mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net"
   ```

---

## 3. Jalankan Server

```bash
# Set variabel (opsional jika pakai localhost)
export MONGODB_URI="mongodb://localhost:27017"  # atau Atlas URI
export MONGODB_DB="churniq"                     # nama database (default: churniq)
export CHURNIQ_MODEL_PATH="/path/to/model.json"
export CHURNIQ_PORT=5000

python server.py
```

Output yang diharapkan:
```
[ChurnIQ] Loading model from /path/to/model.json
[ChurnIQ] Model loaded — N trees, base_score=0.5
[ChurnIQ] MongoDB connected → mongodb://localhost:27017 / db=churniq
[ChurnIQ] API running on http://localhost:5000
```

---

## 4. Struktur Database MongoDB

### Collection: `customers`
Setiap dokumen = satu baris customer dari CSV, sudah di-score oleh XGBoost.
```json
{
  "id": "CUST-00001",
  "callFailures": 3,
  "complains": 0,
  "subLength": 24,
  "chargeAmount": 5,
  "secondsUse": 26220,
  "freqUse": 72,
  "freqSMS": 15,
  "distinctNums": 34,
  "ageGroup": 2,
  "tariffPlan": 1,
  "status": 1,
  "custValue": 412.5,
  "churn": 0,
  "riskScore": 42,
  "riskLevel": "medium",
  "session_id": "ObjectId string",
  "imported_at": "2025-01-01T10:00:00"
}
```

### Collection: `sessions`
Setiap import CSV = satu session record.
```json
{
  "filename": "Customer_Churn.csv",
  "imported_at": "2025-01-01T10:00:00",
  "count": 3150
}
```

---

## 5. Cara Kerja Tombol

### Import CSV
- Parse CSV → XGBoost scoring → **simpan ke MongoDB** → cache ke localStorage
- Setiap import MENAMBAHKAN data (append), tidak menimpa

### Delete Data
- Klik tombol merah "Delete Data" di topbar
- Muncul konfirmasi modal
- Jika konfirmasi: hapus semua dokumen dari MongoDB + clear localStorage cache
- Dashboard langsung kembali ke empty state

### Load saat Buka Halaman
- Cek MongoDB dulu via `/data/status`
- Jika ada data → load dari MongoDB → update localStorage cache
- Jika MongoDB tidak tersedia → fallback ke localStorage

---

## 6. API Endpoints Baru

| Method | Endpoint | Fungsi |
|--------|----------|--------|
| POST | `/data/save` | Simpan batch customers ke MongoDB |
| GET | `/data/load` | Load semua customers dari MongoDB |
| DELETE | `/data/delete` | Hapus semua data dari MongoDB |
| GET | `/data/status` | Cek koneksi + jumlah records |

---

## 7. Jika MongoDB Tidak Tersedia

Server tetap berjalan dan semua fitur prediksi berfungsi normal.
Data hanya disimpan di localStorage browser.
Toast warning akan muncul: *"⚠ MongoDB unavailable — data saved locally only"*
