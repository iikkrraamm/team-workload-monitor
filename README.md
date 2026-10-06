# Team Workload Monitor

Aplikasi monitoring beban kerja tim — full stack (Flask + React) dengan deteksi
overload, deteksi burnout, dan asisten chat AI untuk CRUD tugas secara cepat.

## Fitur

1. **Monitoring tugas tim** — Kanban board (Belum Dikerjakan / Dikerjakan / Selesai)
   dan tampilan List dengan informasi yang sama seperti kartu Kanban (rentang
   tanggal, kapasitas tersedia, status jadwal, estimasi, sisa hari kerja, risiko).
   List punya filter **status** tambahan (hanya di mode List).
2. **Workload harian, mingguan, bulanan** — dihitung dari estimasi jam tugas yang
   disebar merata ke hari kerja (Senin–Jumat) dalam rentang tanggalnya,
   dibandingkan kapasitas jam/hari tiap anggota. Sabtu/Minggu idle kecuali ada
   tugas yang due-nya jatuh di akhir pekan.
3. **Deteksi overload + saran pintar** — saat status seseorang Overload (bawaan: beban
   ≥110% kapasitas, bisa diatur di menu Pengaturan),
   sistem menyarankan *reschedule* (tugas prioritas rendah digeser) atau
   *reassign* ke rekan tim yang masih longgar, mempertimbangkan prioritas tugas.
4. **Deteksi burnout** — melihat 14 hari terakhir (sampai hari ini). Tiap hari
   punya status: **overload** (hari kerja berstatus Overload, bawaan ≥110%
   kapasitas), **normal** (hari kerja lainnya, memutus streak), **lembur** (Sabtu/Minggu yang punya jam
   kerja, **berapa pun jumlah jamnya**; ini menambah streak karena hari
   istirahat dipakai bekerja), dan **libur** (Sabtu/Minggu tanpa jam; dilewati,
   tidak memutus dan tidak menambah). `streak` adalah rangkaian hari
   overload/lembur yang berakhir hari ini, melangkahi akhir pekan yang idle;
   `overload_days` menghitung hari overload dan lembur, jadi streak tidak
   pernah lebih besar darinya. Contoh: Senin–Jumat overload, akhir pekan idle,
   lalu Senin–Rabu overload = streak 8; Sabtu 1 jam kerja di antaranya
   menambah 1 poin. Risiko **tinggi** jika streak ≥5 **atau** ≥10 dari 14 hari;
   **sedang** jika streak ≥3 **atau** ≥6 dari 14 hari. Hari kerja yang tidak
   overload (termasuk hari cuti) memutus streak. Dashboard hanya menampilkan
   peringatan untuk risiko **tinggi** (risiko sedang tetap dihitung dan tersedia
   di `/api/burnout`, bersama `state` tiap hari), dengan saran mengambil
   cuti/istirahat. Tugas berkategori **Cuti/Libur** tidak dihitung sebagai beban
   di sini, jadi orang yang sedang cuti tidak ikut ditandai, dan akhir pekan
   yang hanya berisi tugas cuti dianggap libur. (Persentase beban di dashboard
   dan Analisis Beban tetap menghitung semua tugas.)
5. **Klasifikasi status** — Idle (0 jam), Low (<30%), Normal (30–80%),
   Padat (>80% sampai <110%), Overload (≥110%) — tampil di dashboard per anggota.
   Tiga batas (Low, Normal, Overload) adalah **pengaturan**, bukan konstanta kode:
   lihat butir 9.
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

8. **Mode gelap** — tombol "Mode gelap" di sidebar (desktop) dan ikon matahari/bulan
   di bar atas (HP). Pilihan disimpan di browser (`localStorage`, kunci `app-theme`),
   sama seperti pilihan Kanban/List. Selama belum memilih, aplikasi mengikuti
   pengaturan sistem (dan ikut berubah bila pengaturan itu berubah); setelah memilih,
   pilihan pengguna yang dipakai, termasuk di tab lain. Tema diterapkan sebelum
   halaman tampil, jadi tidak ada kilatan putih saat memuat.

   Untuk pengembang: warna adalah token CSS variable (`index.css`) yang dipakai lewat
   kelas Tailwind (`bg-surface`, `bg-canvas`, `text-ink`, `text-ink-soft`,
   `border-line`, `text-accent`, `text-ok` / `text-warn` / `text-info`). Jangan
   memakai `bg-white` atau warna hex langsung di komponen, karena tidak akan ikut
   berganti tema. `bg-accent-solid` untuk isian biru di bawah teks putih (tombol,
   bubble chat). Warna di dalam chart Recharts diatur di `CHART_THEME`
   (`WorkloadPage.jsx`), karena atribut SVG tidak bisa membaca CSS variable.

9. **Pengaturan ambang beban** — menu *Pengaturan* (di HP: Lainnya → Pengaturan)
   untuk mengubah batas status tanpa mengubah kode atau me-restart server:
   - *Low: di bawah* (bawaan 30%): beban di bawah angka ini berstatus Low.
   - *Normal: sampai* (bawaan 80%): dari batas Low sampai angka ini (termasuk) Normal.
   - *Overload: mulai dari* (bawaan 110%): beban ≥ angka ini berstatus Overload;
     di antara batas Normal dan angka ini adalah Padat.

   Halaman memberi pratinjau pita status secara langsung beserta padanan jamnya
   (untuk kapasitas 8 jam/hari), memvalidasi isian (angka, > 0, ≤ 1000%, dan
   Low < Normal < Overload), dan punya tombol "Kembalikan ke bawaan". Batas yang
   sama dipakai di dashboard, Analisis Beban, saran overload, dan peringatan
   burnout (hari kerja dihitung overload bila statusnya Overload); persen yang
   tampil adalah persen yang diklasifikasikan (dibulatkan 1 desimal). Idle selalu
   berarti 0 jam. Nilai disimpan di tabel `app_settings` (dibuat otomatis) dan
   berlaku untuk semua pengguna, karena aplikasi belum punya login. Nilai yang
   rusak, tidak konsisten, atau tabel yang belum ada otomatis jatuh ke bawaan.
   API: `GET /api/settings/thresholds`, `PUT` (boleh sebagian; kolom yang tidak
   dikirim tetap), dan `DELETE` (kembali ke bawaan).

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
  disebar merata ke **hari kerja (Senin–Jumat)** dalam rentang tersebut. Tugas
  Senin–Jumat 40 jam = 8 jam per hari kerja; tugas Jumat→Senin 8 jam = 4 jam
  Jumat + 4 jam Senin. Sabtu/Minggu tidak menerima jam (beban turun dan status
  menjadi Idle), **kecuali** tugas itu due di Sabtu/Minggu: maka akhir pekan
  tempat due date itu berada ikut dibagi (hari due itu sendiri, ditambah Sabtu
  sebelum due Minggu bila tugas sudah mulai). Akhir pekan lain di tengah tugas
  yang panjang tidak ikut. Kapasitas diselaraskan: hari akhir pekan dihitung
  sebagai hari kapasitas hanya bila ada tugas yang menaruh jam di hari itu
  (tugas selesai tetap dihitung untuk hari-hari yang sudah lewat), sehingga jam
  tidak pernah dibandingkan dengan kapasitas nol dan satu tugas Minggu saja
  menambah 1 hari (6 hari kapasitas), bukan 7. Aturan ini sama dengan alokasi di
  kartu tugas (risiko tidak cukup jam).
- Workload periode = total jam tugas aktif dalam periode ÷ (kapasitas jam/hari
  anggota × jumlah hari periode) × 100%.
- **Rincian kontribusi** (tombol di halaman Analisis Beban) menjumlah persis ke
  angka "jam terpakai" pada kartu, karena memakai aturan hitung yang sama:
  estimasi tiap tugas dibagi rata ke hari kerjanya dari `start_date` sampai
  `due_date` (aturan di atas), lalu hanya hari yang masuk periode yang
  dijumlahkan, ditambah jam aktivitas. Untuk tugas dengan deadline lebih panjang
  dari periode, rincian menampilkan estimasi, jumlah hari kerja pembagi, jam per
  hari, jumlah hari di periode, dan sisa jam di luar periode. Tugas cuti dan
  tugas selesai tampil dengan penanda; tugas selesai hanya dihitung sampai hari
  ini. Daftar "Sedang dikerjakan" di dashboard pada hari Sabtu/Minggu hanya
  menampilkan tugas yang memang dikerjakan di akhir pekan itu, supaya tidak
  bertentangan dengan status Idle.
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
- **Urutan tugas** (Kanban dan List memakai urutan yang sama, ditentukan server):
  due date → prioritas (urgent dulu) → waktu dibuat → id. Dua kunci terakhir
  membuat urutan pasti, sehingga tugas dengan due date sama tidak bertukar
  tempat dan paginasi (`LIMIT/OFFSET`) tidak mengulang atau melewatkan tugas.
  Arah: due date paling awal di atas (yang lewat deadline otomatis di paling
  atas), kecuali bila hanya status `done` yang diminta (kolom Selesai atau
  filter Selesai): due date terbaru di atas. Parameter opsional
  `sort=due_asc|due_desc` pada `/api/tasks` menimpa arah itu.
- **Index database**: `idx_tasks_status_due (status, due_date)` untuk kolom
  Kanban dan `idx_tasks_assignee (assignee_id)` untuk filter anggota dan
  perhitungan beban. Dibuat otomatis (`CREATE INDEX IF NOT EXISTS`) saat aplikasi
  start. Diukur pada 100 ribu tugas: query satu kolom Kanban turun dari ±15 ms
  menjadi ±0,2 ms. Filter dua status sekaligus di List justru sedikit lebih
  lambat (±20 → ±60 ms pada 100 ribu tugas) karena planner SQLite memakai
  index lalu mengurutkan seluruh hasil; pada ribuan tugas selisihnya tak terasa.
- **Status jadwal tugas** (Kanban dan List, hanya tugas `todo` / `in_progress`;
  tugas selesai dan cuti tidak dinilai):
  - *Seharusnya* (should-be progress) = jam kumulatif yang direncanakan ÷
    estimasi, yaitu hari kerja yang sudah berlalu ÷ jumlah hari kerja tugas × 100%.
    Memakai **rencana yang sama persis dengan pembagian jam** (hari kerja
    Senin–Jumat, plus akhir pekan tempat due bila tugas due di Sabtu/Minggu),
    sehingga selalu selaras. Empat hari kerja berturut-turut (mis. Senin–Kamis)
    → 25% / 50% / 75% / 100%. Progres diam selama akhir pekan yang tidak
    dikerjakan: tugas Jumat→Senin 8 jam = 50% di Jumat, Sabtu, dan Minggu, 100%
    di Senin. Sebelum start 0%, dari due date 100%.
  - **Lewat deadline**: due date sudah lewat dan tugas belum selesai.
  - **Terlambat**: masih `todo` padahal sedikitnya satu hari kerja tugas itu
    sudah lewat tanpa dimulai. Akhir pekan yang tidak membawa jam tidak dihitung
    sebagai hari yang lewat (tugas yang start Sabtu tidak terlambat di Minggu).
  - **On track**: selain itu (sedang dikerjakan, atau `todo` sebelum atau pada
    hari kerja pertamanya).
  - Belum ada data progres aktual (persen selesai), jadi penilaiannya memakai
    status dan tanggal saja; tugas `in_progress` baru dinilai terlambat setelah
    lewat deadline.
  - API: `/api/tasks` menambah field `schedule` per tugas. Parameter opsional
    `date=YYYY-MM-DD` menentukan "hari ini" (frontend mengirim tanggal lokal
    pengguna); tanpa itu dipakai tanggal server.
- **Tugas Berisiko (Tidak Cukup Jam)** — tiap tugas dinilai *cukup* / *tidak
  cukup* dengan membandingkan sisa kapasitas anggota sampai deadline dengan jam
  yang masih dibutuhkan. Tugas yang sudah **selesai** dan tugas berkategori
  **Cuti/Libur** tidak dinilai: tidak mendapat badge risiko, tidak muncul di
  daftar Tugas Berisiko, dan tidak dibuatkan saran reassign. Perhatikan bahwa
  jam cuti tetap memakai kapasitas anggota tersebut, karena orang yang cuti
  memang tidak bisa mengerjakan tugas lain di hari itu, sehingga tugas kerja di
  periode yang sama tetap bisa ditandai berisiko. Tugas selesai tidak memakan
  kapasitas sama sekali.

## Asisten AI (OpenAI)

Chat memakai OpenAI SDK dengan function calling untuk memilih tindakan dari
percakapan natural: mengelola tugas, mengecek workload, atau membuat query SQL.
Query SQL menggunakan schema database aplikasi, diperiksa dalam mode read-only,
lalu otomatis disimpan di menu **SQL Client**.

Atur variabel berikut di `backend/.env`:

```dotenv
OPENAI_API_KEY=
OPENAI_BASE_URL=
OPENAI_MODEL=gpt-4o-mini
```

`OPENAI_BASE_URL` opsional untuk endpoint OpenAI-compatible. Konfigurasi lama
`OLLAMA_URL`, `OLLAMA_TOKEN`, dan `OLLAMA_MODEL` masih didukung sebagai fallback.
Install dependensi backend dengan `pip install -r backend/requirements.txt`.

- Autentikasi multi-user belum ada — cocok untuk satu tim/workspace. Untuk
  banyak tim, tambahkan tabel `teams` dan filter berdasarkan `team_id`.
