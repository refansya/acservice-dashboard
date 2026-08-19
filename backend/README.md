# Admin Dashboard Backend — project.id Services (AC + Elektronik)

Backend API untuk admin dashboard servis AC dan elektronik. Stack: PostgreSQL, Express, Node.js (PERN — bagian ERN).

## Setup

```bash
npm install
cp .env.example .env
# isi DATABASE_URL dan JWT_SECRET di .env

npx prisma migrate dev --name init
npm run prisma:seed
npm run dev
```

Server jalan di `http://localhost:4000`. Login default setelah seed: `admin@projectid.services` / `admin123`.

## Struktur

```
prisma/
  schema.prisma      # skema database
  seed.js             # data awal (service types + admin user)
src/
  config/prisma.js    # Prisma client singleton
  middleware/          # auth (JWT) & error handler
  controllers/          # logika bisnis tiap modul
  routes/                # definisi endpoint
  index.js               # entry point Express
```

## Modul & Endpoint Utama

| Modul | Endpoint | Keterangan |
|---|---|---|
| Auth | `POST /api/auth/register`, `POST /api/auth/login` | Register & login admin/staff |
| Customers | `GET/POST/PATCH/DELETE /api/customers` | CRUD pelanggan |
| Technicians | `GET/POST/PATCH/DELETE /api/technicians` + `/schedule` | CRUD teknisi & jadwal |
| Service Types | `GET/POST/PATCH/DELETE /api/service-types` | Jenis layanan AC/elektronik |
| Orders | `GET/POST /api/orders`, `PATCH /:id/assign`, `PATCH /:id/status` | Order & status servis |
| Invoices | `POST /api/invoices/from-order/:orderId`, `PATCH /:id/pay` | Generate & bayar invoice |
| Reports | `GET /api/reports/revenue`, `/top-services`, `/technician-performance`, `/category-breakdown` | Laporan & analitik |
| Portal Teknisi | `GET /api/my/orders`, `/api/my/orders/:id`, `PATCH .../status`, `PATCH .../notes`, `PATCH .../job-details`, `POST .../items`, `POST .../photos` | Teknisi lihat & update order miliknya sendiri, termasuk detail layanan + komisi helper |
| Laporan Komisi | `GET /api/reports/helper-commissions` | Rekap komisi tiap helper (admin) |

## Komisi Helper

Setiap kunjungan bisa melibatkan satu atau lebih **helper** (asisten teknisi, orang berbeda dari teknisi utama). Teknisi mengisi `jobType` (INSTALASI/MAINTENANCE/SERVICE) dan `jobCost` lewat `PATCH /api/my/orders/:id/job-details`, lalu backend otomatis menghitung komisi:

- Rate: MAINTENANCE 10%, INSTALASI & SERVICE 15% (lihat `src/config/commission.js`)
- Total pool komisi = `jobCost × rate`, dibagi rata ke semua helper pada order tsb
- Tersimpan di tabel `OrderHelper` (snapshot rate & amount saat itu, tidak berubah walau rate config diubah nanti)

## Portal Teknisi

Teknisi login pakai akun `role: TECHNICIAN` yang terhubung ke data `Technician` lewat `technicianId`. Buat akun ini via `POST /api/technicians/:id/account` (admin only, body: `{ email, password }`). Setelah login, JWT membawa `technicianId`, dan semua endpoint `/api/my/*` otomatis membatasi data hanya milik teknisi tersebut.

Upload foto sebelum/sesudah disimpan di folder `uploads/` (disajikan statis di `/uploads/<filename>`) — untuk produksi, sebaiknya diarahkan ke object storage (S3-compatible) alih-alih disk lokal.

Semua endpoint (kecuali `/api/auth/*` dan `/health`) butuh header `Authorization: Bearer <token>`.

## Alur Order → Invoice

1. Buat order (`POST /api/orders`) — status `PENDING` atau `ASSIGNED` kalau langsung assign teknisi
2. Update status seiring progres: `ASSIGNED` → `IN_PROGRESS` → `DONE`
3. Setelah `DONE`, generate invoice: `POST /api/invoices/from-order/:orderId`
4. Tandai lunas: `PATCH /api/invoices/:id/pay`

## Belum diimplementasikan (langkah selanjutnya)

- Export invoice ke PDF (lib `pdfkit` sudah masuk dependency, tinggal diimplementasikan)
- Frontend admin dashboard (sudah ada di folder terpisah `acservice-dashboard-frontend`)
- Deployment ke VPS via Docker + Nginx Proxy Manager
