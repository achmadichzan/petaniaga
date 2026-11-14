# Petaniaga — Platform Peta Niaga Hasil Tani, Laut & UMKM Lokal (D2C)

Aplikasi web **direct-to-consumer (D2C)** untuk menghubungkan penjual hasil tani, laut, dan UMKM lokal langsung dengan pembeli di sekitar lokasi tanpa perantara tengkulak. Dibangun dengan arsitektur **Modular Monolith** menggunakan **SvelteKit 3 + Cloudflare Stack** (Pages, D1, R2, Leaflet + OpenStreetMap, Stateless JWT, Google OAuth, Direct WhatsApp).

## Fitur Utama

- **Pembeli Bebas Login & Peta Interaktif (`(public)` / `modules/geo`)**:
  - Peta interaktif **Leaflet.js + OpenStreetMap** dengan filter kategori (`sayur`, `beras`, `buah`, `umbi`, `lainnya`).
  - Query **Bounding Box** berindeks di D1 (`idx_peta_produk`) + `LIMIT 100` dan guard zoom minimum agar super hemat kuota read D1.
  - Tombol **"Cari di Sekitarku"** (GPS) dan tombol **"Pesan via WhatsApp"** (`wa.me`) dengan pesan pesanan otomatis.
- **Auth Penjual 1-Klik & 0 DB Read (`modules/auth`)**:
  - **Google OAuth** via `arctic`, disusul **Stateless JWT 365 hari** di `HttpOnly Cookie` (`jose`) sehingga `hooks.server.ts` tidak perlu melakukan query ke D1 di setiap request.
  - **Onboarding WA 1 Langkah** (`/onboarding-wa`) yang langsung me-*re-sign* cookie JWT agar tidak terjadi *redirect loop*.
  - **Deteksi In-App Browser** (WhatsApp, Facebook, Instagram, LINE, TikTok) dengan tombol `intent://` ke Google Chrome agar tidak terkena error `disallowed_useragent`.
- **Upload Foto Hemat Kuota & Dashboard Outdoor-Friendly (`modules/catalog`)**:
  - Kompresi foto otomatis di browser menggunakan HTML5 `<canvas>` ke format **WebP (~50–80 KB)** sebelum dikirim ke server dan disimpan ke **Cloudflare R2**.
  - Endpoint proxy R2 (`/api/photos/[...key]`) dengan `Cache-Control: public, max-age=31536000, immutable` tanpa wajib membeli custom domain.
  - Tombol cepat **Tandai Stok Habis / Aktifkan Lagi**, **Perpanjang 14 Hari**, dan **Hapus** (membersihkan D1 dan R2 sekaligus).

## Setup Lokal

1. **Salin konfigurasi environment lokal**:
   ```bash
   cp .dev.vars.example .dev.vars
   ```
   Isi `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, dan `JWT_SECRET` (minimal 32 karakter). Untuk menguji dashboard penjual secara offline tanpa Google OAuth saat development, Anda bisa menyetel `ENABLE_DEV_LOGIN=true` di `.dev.vars` (otomatis nonaktif pada build produksi).

2. **Inisialisasi database D1 lokal + data contoh**:
   ```bash
   bunx wrangler d1 execute db-petaniaga --local --file=./migrations/0001_initial_schema.sql
   bunx wrangler d1 execute db-petaniaga --local --file=./migrations/seed_dev.sql
   ```

3. **Jalankan server development**:
   ```bash
   bun run dev
   ```

4. **Pengujian & Type Check**:
   ```bash
   bun run check
   bun run test
   bun run build
   ```

## Deploy ke Cloudflare Pages (Rp 0 Tier)

1. Buat resource D1 & R2 di akun Cloudflare Anda:
   ```bash
   bunx wrangler d1 create db-petaniaga
   bunx wrangler r2 bucket create foto-panen
   ```
2. Masukkan `database_id` hasil perintah `d1 create` ke dalam `wrangler.jsonc`, lalu jalankan migrasi remote:
   ```bash
   bunx wrangler d1 execute db-petaniaga --remote --file=./migrations/0001_initial_schema.sql
   ```
3. Set secrets di Cloudflare Pages (`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `JWT_SECRET`, `APP_URL`), lalu build & deploy:
   ```bash
   bun run build
   bunx wrangler pages deploy .svelte-kit/cloudflare
   ```
