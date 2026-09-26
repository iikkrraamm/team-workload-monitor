# Team Workload Monitor

Aplikasi monitoring beban kerja tim — full stack (Flask + React) dengan deteksi
overload, deteksi burnout, dan asisten chat AI untuk CRUD tugas secara cepat.

## Fitur

1. **Monitoring tugas tim** — Kanban board (Belum Dikerjakan / Dikerjakan / Selesai).
2. **Workload harian, mingguan, bulanan** — dihitung dari estimasi jam tugas yang
   disebar merata di sepanjang rentang tanggalnya, dibandingkan kapasitas jam/hari
   tiap anggota.
3. **Deteksi overload + saran pintar** — saat beban seseorang ≥110% kapasitas,
   sistem menyarankan *reschedule* (tugas prioritas rendah digeser) atau
   *reassign* ke rekan tim yang masih longgar, mempertimbangkan prioritas tugas.
4. **Deteksi burnout** — melihat tren 14 hari terakhir; jika overload beruntun
   ≥5 hari atau ≥10 dari 14 hari, sistem menandai risiko tinggi dan menyarankan cuti.
5. **Klasifikasi status** — Idle (<30%), Normal (30–79%), Padat (80–109%),
   Overload (≥110%) — tampil di dashboard per anggota.
6. **CRUD super cepat** — quick-add satu baris di halaman Tugas, drag status
   lewat tombol pada kartu, dan **chat AI** di pojok kanan bawah untuk perintah
   bahasa natural, misalnya:
   - `tambah task 'Review kode' untuk Budi prioritas tinggi 3 jam due besok`
   - `workload Sari minggu ini`
   - `tandai selesai Review kode`
   - `hapus task Review kode`

## Menjalankan Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate   # opsional tapi disarankan
pip install -r requirements.txt
python app.py
```

Server berjalan di `http://localhost:5000` dan otomatis membuat `workload.db`
(SQLite) berisi data contoh (4 anggota tim, 10 tugas) saat pertama kali dijalankan.

Untuk deploy ke PythonAnywhere: upload folder `backend/`, arahkan WSGI file ke
`app.py` (variabel `app`), lalu jalankan `pip install -r requirements.txt` di
konsol Bash mereka.

# team-workload-monitor

## Development
## Menjalankan Frontend

Run both backend and frontend concurrently with:

```bash
./run-dev.sh
```

Or run individually:

Backend:

```bash
cd backend
python3 app.py
```

Frontend (dev):

```bash
cd frontend
npm run dev
```
backend/
  app.py            # Flask configuration, blueprint registration, and startup
  database.py       # SQLite connection, schema, and seed data
  workload.py       # Shared date, allocation, and task workload helpers
  chat.py           # Natural-language chat parser and actions
  serializers.py    # Database row serialization
  routes/
    members.py      # Member and activity endpoints
    tasks.py        # Task and task-risk endpoints
    workload.py     # Workload, burnout, and dashboard endpoints
    system.py       # Chat and health endpoints
  requirements.txt
frontend/
  src/
    App.jsx         # seluruh halaman & komponen (Dashboard, Tugas, Analisis Beban, Tim, Chat)
    api.js          # client fetch ke backend
    styles.css      # design system neumorphic
    main.jsx
  index.html
  package.json
  vite.config.js
```

## Cara Kerja Kalkulasi Workload (ringkas)

- Setiap tugas punya `estimated_hours`, `start_date`, `due_date`. Jam tugas
  disebar merata per hari dalam rentang tersebut.
- Workload periode = total jam tugas aktif dalam periode ÷ (kapasitas jam/hari
  anggota × jumlah hari periode) × 100%.
- Saran overload memprioritaskan tugas dengan prioritas terendah untuk
  dipindah lebih dulu, dan mencari rekan tim dengan status Idle/Normal yang
  punya slack kapasitas cukup sebelum menyarankan reassign; jika tidak ada,
  menyarankan reschedule deadline.
- Risiko burnout dihitung dari 14 hari data historis (dihitung ulang dari
  tugas yang overlap tiap tanggal), bukan snapshot tersimpan — jadi selalu
  konsisten dengan data tugas terbaru.

## Mengembangkan Lebih Lanjut

- Asisten chat saat ini berbasis pola kata kunci (bahasa Indonesia) — cepat
  dan tanpa biaya API. Untuk pemahaman bahasa yang lebih fleksibel, endpoint
  `/api/ai-chat` di `app.py` bisa diganti agar memanggil Claude API
  (`api.anthropic.com/v1/messages`) dengan pesan pengguna + daftar tugas/anggota
  sebagai konteks, lalu memakai *tool use* untuk mengeksekusi CRUD yang sama.
- Autentikasi multi-user belum ada — cocok untuk satu tim/workspace. Untuk
  banyak tim, tambahkan tabel `teams` dan filter berdasarkan `team_id`.
