# Admin Dashboard Frontend — project.id Services (AC + Elektronik)

React (Vite) + PERN stack. Tema navy/ice-blue/signal-red, konsisten dengan company profile.

## Setup

```bash
npm install
cp .env.example .env
# pastikan VITE_API_URL mengarah ke backend, default http://localhost:4000/api

npm run dev
```

Buka `http://localhost:5173`. Login pakai akun hasil seed backend: `admin@projectid.services` / `admin123`.

## Struktur

```
src/
  api/client.js          # axios instance + auto attach JWT token
  context/AuthContext.jsx # state login (token disimpan di localStorage)
  layouts/DashboardLayout.jsx  # sidebar navigasi + shell halaman
  components/              # StatusBadge, Modal, PageHeader, StatCard, ProtectedRoute
  pages/
    Login.jsx
    Overview.jsx           # ringkasan revenue & order terbaru
    Orders.jsx              # CRUD order, assign teknisi, ubah status, buat invoice
    Technicians.jsx          # CRUD teknisi + spesialisasi + buat akun login teknisi
    Customers.jsx             # CRUD pelanggan
    ServiceTypes.jsx           # CRUD jenis layanan AC/elektronik
    Invoices.jsx                # daftar invoice + tandai lunas
    Reports.jsx                  # grafik revenue, servis terlaris, performa teknisi
    technician/
      MyOrders.jsx                # daftar order milik teknisi yang login
      MyOrderDetail.jsx            # update status, catatan, item, & foto sebelum/sesudah
```

## Portal Teknisi

Setelah admin membuatkan akun lewat tombol **Buat Akun** di halaman Teknisi, teknisi login pakai form yang sama. Sistem otomatis mendeteksi `role: TECHNICIAN` dan mengarahkan ke `/my/orders` — tampilan mobile-friendly berisi order yang ditugaskan ke teknisi tersebut saja. Di detail order, teknisi bisa: ubah status (Mulai Kerjakan / Selesai), isi **jenis layanan + biaya + helper** (komisi helper terhitung otomatis dan langsung terlihat sebelum disimpan), isi catatan pengerjaan, tambah sparepart/item, dan unggah foto sebelum & sesudah (langsung dari kamera HP via `capture="environment"`).

Rekap komisi semua helper bisa dilihat admin di halaman **Laporan**.

## Alur pakai

1. Login
2. Tambah pelanggan, teknisi, dan jenis layanan dulu (atau pakai data seed backend)
3. Buat order dari halaman **Order Servis** → klik baris order untuk buka detail
4. Di detail order: assign teknisi, update status sampai `DONE`
5. Setelah `DONE`, klik **Buat Invoice** di detail order
6. Tandai lunas di halaman **Invoice**
7. Lihat hasilnya di **Laporan**

## Belum diimplementasikan (langkah selanjutnya)

- Jadwal teknisi per hari (endpoint backend sudah ada, UI kalender belum)
- Export invoice ke PDF
- Deployment ke VPS via Docker + Nginx Proxy Manager
