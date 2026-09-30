# Team Workload Monitor

Aplikasi monitoring beban kerja tim — full stack (Flask + React) dengan deteksi
overload, deteksi burnout, dan asisten chat AI untuk CRUD tugas secara cepat.

## Fitur

1. **Monitoring tugas tim** — Kanban board (Belum Dikerjakan / Dikerjakan / Selesai).
2. **Workload harian, mingguan, bulanan** — dihitung dari estimasi jam tugas yang
   disebar merata di sepanjang rentang tanggalnya, dibandingkan kapasitas jam/hari
   tiap anggota.
3. **Deteksi overload + saran pintar** — saat beban seseorang di atas 100% kapasitas,
   sistem menyarankan *reschedule* (tugas prioritas rendah digeser) atau
   *reassign* ke rekan tim yang masih longgar, mempertimbangkan prioritas tugas.
4. **Deteksi burnout** — melihat 14 hari terakhir (sampai hari ini). Sebuah hari
   dihitung overload jika bebannya di atas 100% kapasitas harian. Risiko
   **tinggi** jika overload beruntun (`streak`, dihitung mundur dari hari ini)
   ≥5 hari **atau** ≥10 dari 14 hari overload; risiko **sedang** jika streak ≥3
   hari **atau** ≥6 dari 14 hari. Dashboard hanya menampilkan peringatan untuk
   risiko **tinggi** (risiko sedang tetap dihitung dan tersedia di
   `/api/burnout`), dengan saran mengambil cuti/istirahat.
   Tugas berkategori **Cuti/Libur** tidak dihitung sebagai beban di sini, jadi
   orang yang sedang cuti tidak ikut ditandai. (Persentase beban di dashboard dan
   Analisis Beban tetap menghitung semua tugas.) Catatan: hari cuti memutus
   streak, tetapi hari overload sebelumnya tetap masuk hitungan 14 hari. Jadi
   anggota yang cuti setelah ≥10 hari overload masih bisa muncul (risiko tinggi
   lewat syarat 10 dari 14 hari) sampai hari-hari overload itu keluar dari jendela.
5. **Klasifikasi status** — Idle (0 jam), Low (<30%), Normal (30–80%),
   Padat (>80–100%), Overload (>100%) — tampil di dashboard per anggota.
6. **CRUD super cepat** — quick-add satu baris di halaman Tugas, drag status
   lewat tombol pada kartu, dan **chat AI** di pojok kanan bawah untuk perintah
   bahasa natural, misalnya:
   - `tambah task 'Review kode' untuk Budi prioritas tinggi 3 jam due besok`
   - `workload Sari minggu ini`
   - `tandai selesai Review kode`
   - `hapus task Review kode`
7. **SQL Client** — menu untuk menjalankan query ke database aplikasi dan
   melihat hasilnya dalam tabel. Query yang sering dipakai bisa **disimpan**,
   dibuka lagi, diubah namanya, atau dihapus. Blok teks di editor bisa
   dijalankan sendiri, dan `Ctrl/⌘ + Enter` menjalankan query.

   Karena aplikasi belum punya login, SQL Client **read-only secara default**
   (hanya `SELECT` dan PRAGMA metadata; dipaksa oleh SQLite, bukan sekadar
   cek teks). Hasil dibatasi 1000 baris dan waktu eksekusi 5 detik. Untuk
   mengizinkan `INSERT/UPDATE/DELETE/DDL`, set env var
   `SQL_CLIENT_ALLOW_WRITE=1` di server, dan hanya lakukan itu kalau akses ke
   aplikasi sudah dibatasi.

   **Ekspor hasil:** tombol *Ekspor* di atas tabel hasil mengunduh data sebagai
   Excel (`.xlsx`) atau teks dengan delimiter yang bisa dipilih (koma,
   titik koma, tab, pipe, atau karakter kustom hingga 10 karakter), dengan
   opsi menyertakan baris judul. Ekspor menjalankan ulang query dan mencakup
   hingga 100.000 baris (tabel di layar hanya 1000). Ekspor selalu read-only,
   dan sel teks yang diawali `= + - @` diberi tanda `'` secara default agar
   tidak dieksekusi sebagai formula saat dibuka di Excel/Sheets. File Excel
   dibuat tanpa library tambahan, jadi tidak ada paket baru yang perlu
   di-install di server.

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
    sql.py          # SQL client, saved queries, export
  exporters.py      # .xlsx and delimited-text writers
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
- **Rincian kontribusi** (tombol di halaman Analisis Beban) menjumlah persis ke
  angka "jam terpakai" pada kartu, karena memakai aturan hitung yang sama:
  estimasi tiap tugas dibagi rata ke semua hari kalender dari `start_date`
  sampai `due_date` (akhir pekan ikut dihitung), lalu hanya hari yang masuk
  periode yang dijumlahkan, ditambah jam aktivitas. Untuk tugas dengan deadline
  lebih panjang dari periode, rincian menampilkan estimasi, jumlah hari
  pembagi, jam per hari, jumlah hari di periode, dan sisa jam di luar periode.
  Tugas cuti dan tugas selesai tampil dengan penanda; tugas selesai hanya
  dihitung sampai hari ini. Hari akhir pekan menambah jam terpakai bila ada
  tugas yang rentangnya melewatinya, tetapi kapasitas hanya menghitung hari
  kerja (kecuali ada tugas yang deadline-nya jatuh di akhir pekan).
- Saran overload (halaman Analisis Beban) memprioritaskan tugas dengan prioritas
  terendah untuk dipindah lebih dulu. Hanya tugas kerja yang belum selesai yang
  bisa disarankan: tugas **Cuti/Libur** dan tugas **selesai** tidak pernah masuk
  saran. Reassign hanya ke rekan dengan **peran yang sama** (dicocokkan tanpa
  membedakan huruf besar/kecil dan spasi; anggota tanpa peran dianggap tidak
  punya rekan seperan) yang berstatus Idle/Normal dan punya slack kapasitas
  cukup. Jika tidak ada yang memenuhi, sistem menyarankan reschedule deadline.
  Jam cuti dan tugas selesai tetap ikut dihitung dalam persentase beban itu
  sendiri, hanya saja keduanya tidak bisa dipindahkan.
- Risiko burnout dihitung dari 14 hari data historis (dihitung ulang dari
  tugas yang overlap tiap tanggal), bukan snapshot tersimpan — jadi selalu
  konsisten dengan data tugas terbaru.
- **Tugas Berisiko (Tidak Cukup Jam)** — tiap tugas dinilai *cukup* / *tidak
  cukup* dengan membandingkan sisa kapasitas anggota sampai deadline dengan jam
  yang masih dibutuhkan. Tugas yang sudah **selesai** dan tugas berkategori
  **Cuti/Libur** tidak dinilai: tidak mendapat badge risiko, tidak muncul di
  daftar Tugas Berisiko, dan tidak dibuatkan saran reassign. Perhatikan bahwa
  jam cuti tetap memakai kapasitas anggota tersebut, karena orang yang cuti
  memang tidak bisa mengerjakan tugas lain di hari itu, sehingga tugas kerja di
  periode yang sama tetap bisa ditandai berisiko. Tugas selesai tidak memakan
  kapasitas sama sekali.

## Mengembangkan Lebih Lanjut

- Asisten chat saat ini berbasis pola kata kunci (bahasa Indonesia) — cepat
  dan tanpa biaya API. Untuk pemahaman bahasa yang lebih fleksibel, endpoint
  `/api/ai-chat` di `app.py` bisa diganti agar memanggil Claude API
  (`api.anthropic.com/v1/messages`) dengan pesan pengguna + daftar tugas/anggota
  sebagai konteks, lalu memakai *tool use* untuk mengeksekusi CRUD yang sama.
- Autentikasi multi-user belum ada — cocok untuk satu tim/workspace. Untuk
  banyak tim, tambahkan tabel `teams` dan filter berdasarkan `team_id`.
