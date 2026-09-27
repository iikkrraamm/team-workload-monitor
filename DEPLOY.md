# Deploy ke PythonAnywhere (otomatis via GitHub Actions)

## Cara kerja
1. Push ke branch `main`.
2. GitHub Actions (`.github/workflows/deploy.yml`) build frontend, commit
   `frontend/dist` yang baru (kalau berubah), lalu panggil endpoint
   `/api/deploy` di server.
3. Endpoint itu (`backend/routes/deploy.py`) menjalankan `git pull`
   di server, lalu (kalau env var PythonAnywhere sudah diisi) memicu
   reload Web App lewat API PythonAnywhere.

## Setup sekali di awal

### 1. Di server (PythonAnywhere)
Buka file konfigurasi WSGI kamu (Web tab → WSGI configuration file),
tambahkan sebelum baris `from app import app`:

```python
import os
os.environ["DEPLOY_SECRET"] = "isi-dengan-string-acak-yang-panjang"

# Opsional, supaya reload otomatis (tanpa ini, tetap perlu klik
# "Reload" manual setelah ada perubahan backend):
os.environ["PYTHONANYWHERE_API_TOKEN"] = "token dari Account > API Token"
os.environ["PYTHONANYWHERE_USERNAME"] = "username-pythonanywhere-kamu"
os.environ["PYTHONANYWHERE_DOMAIN"] = "username.pythonanywhere.com"
```

Lalu klik **Reload** sekali secara manual supaya env var di atas aktif.

### 2. Di GitHub (repo Settings → Secrets and variables → Actions)
Tambahkan 2 secrets:
- `DEPLOY_WEBHOOK_URL` — contoh: `https://username.pythonanywhere.com/api/deploy`
- `DEPLOY_TOKEN` — harus **sama persis** dengan `DEPLOY_SECRET` di atas

## Setelah itu
Push ke `main` seperti biasa — build, commit dist, dan deploy jalan otomatis.
Kalau env var PythonAnywhere API belum diisi, kamu akan tetap perlu klik
"Reload" manual setelah perubahan backend; perubahan frontend saja tidak
perlu reload sama sekali (file statis langsung ke-update lewat git pull).
