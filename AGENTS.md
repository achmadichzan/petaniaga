# AGENTS.md — Petaniaga

Platform web **Direct-to-Consumer (D2C)** peta niaga hasil tani, laut, dan UMKM lokal untuk menghubungkan penjual langsung dengan pembeli via WhatsApp tanpa perantara. Dirancang berjalan di **Cloudflare Stack** (Pages, D1, R2).

## 1. Tech Stack & Konvensi

- **Framework**: SvelteKit 3 + **Svelte 5 Runes** (`$state`, `$derived`, `$effect`, `$props`) + TypeScript 6 (`strict: true`).
- **Styling**: Tailwind CSS v4 (`src/routes/layout.css`) + Design Tokens di `src/styles/tokens.css` & `DESIGN.md`.
- **Runtime & Storage**: Cloudflare Pages (`@sveltejs/adapter-cloudflare`), Cloudflare D1 (`env.DB` → `db-petaniaga`), Cloudflare R2 (`env.R2_BUCKET` → `petaniaga-images`).
- **Auth**: Google OAuth (`arctic`) + Stateless JWT (`jose`, HttpOnly cookie 365 hari).
- **Peta**: Leaflet.js + OpenStreetMap (`#modules/geo`).
- **Package Manager & Test**: `bun` + `vitest`.

## 2. Struktur & Subpath Imports (`package.json#imports`)

Gunakan alias `#*` (bukan relative path panjang lintas modul):

- `#modules/auth` (`src/lib/modules/auth/`): OAuth Google, JWT stateless (`server/jwt.ts`), deteksi in-app browser (`InAppBrowserBanner.svelte`), onboarding nomor WA (`WaOnboardingForm.svelte`).
- `#modules/catalog` (`src/lib/modules/catalog/`): CRUD produk panen, kartu & modal produk, form tambah produk + kompresi gambar.
- `#modules/geo` (`src/lib/modules/geo/`): Query bounding box peta (`server/`), `MapCanvas.svelte`, `LocationPicker.svelte`.
- `#shared/*` (`src/lib/shared/`):
  - `components/`: `Button`, `Chip`, `Modal`, `Alert`, `Badge`, `Card`, `Field`, `Input`, `Select`, `Icon`, `ImageZoomModal`, `TimeSelect24`.
    Semua primitif form memakai `--radius-control`, `min-h-12` (≥44px), dan hanya token warna; `Field` membungkus label/hint/error, `Select` memakai `<select>` native agar keyboard & IME tetap bawaan browser.
  - `server/`: `env.ts` (akses env/bindings), `r2.ts` (upload/delete R2), `errors.ts`.
  - `utils/`: `image.ts` (kompresi WebP via `<canvas>`), `whatsapp.ts` (format `628...` & link `wa.me`), `lapak.ts` (status jam buka/tutup WIB), `format.ts`.
  - `constants/harvest.ts`: Daftar kategori (`sayur`, `beras`, `buah`, `umbi`, `laut`, `olahan`, `lainnya`) & satuan (`kg`, `ikat`, `karung`, `ton`, `buah`, `pack`).

### Route Groups (`src/routes/`)
- `(public)/`: `/` (peta eksplorasi pembeli tanpa login) & `/api/map-products` (GET produk dalam bounding box).
- `(seller)/`: Dilindungi `(seller)/+layout.server.ts`. Berisi `/onboarding-wa` (wajib isi WA setelah login pertama) dan `/dashboard` (kelola produk, stok, perpanjang 14 hari, jam operasional lapak).
- `/login` & `/auth/*`: `/auth/login/google`, `/auth/callback/google`, `/auth/logout` (+ dev login bila `ENABLE_DEV_LOGIN=true` di `.dev.vars`).
- `/api/photos/[...key]`: Proxy baca objek R2 dengan header `Cache-Control: public, max-age=31536000, immutable`.

## 3. Skema Database D1 (`migrations/0001_initial_schema.sql`)

- **`users`**: `id` (Google `sub`), `nama`, `email`, `no_wa` (unik, format `628...`), `default_lat`, `default_lng`, `is_open` (`1`/`0`), `jam_buka` (`HH:MM`), `jam_tutup` (`HH:MM`), `created_at`.
- **`products`**: `id` (UUID), `user_id` (FK `users.id`), `nama_produk`, `kategori`, `harga` (integer Rupiah), `satuan`, `stok_info`, `foto_url`, `lat`, `lng`, `is_available` (`1`/`0`), `expired_at` (unixepoch, +14 hari), `created_at`.
- **Index**: `idx_peta_produk (is_available, lat, lng, expired_at)`, `idx_produk_penjual (user_id, created_at DESC)`, `idx_users_no_wa (no_wa)`.

## 4. Aturan Arsitektur Wajib (Jangan Dilanggar)

1. **0 DB Read di `hooks.server.ts`**: `src/hooks.server.ts` hanya memverifikasi signature JWT cookie dan mengisi `event.locals.user`. **Jangan** melakukan query D1 di hook setiap request.
2. **Re-sign JWT saat Update Profil Sesi**: Setiap perubahan data yang disimpan di payload JWT (seperti `no_wa` saat `/onboarding-wa`) **wajib** memanggil re-sign cookie JWT agar tidak terjadi *redirect loop*.
3. **Hemat Kuota Read D1 di Peta**: Query peta wajib memfilter `is_available = 1`, `expired_at > unixepoch()`, dan koordinat bounding box agar mengenai `idx_peta_produk`, disertai guard zoom minimum dan `LIMIT 100`.
4. **Kompresi & Cleanup Foto R2**: Foto dikompres di sisi klien menjadi WebP (~50–80 KB) sebelum dikirim ke server. Saat produk dihapus, hapus record di D1 **dan** file objeknya di R2.
5. **In-App Browser Guard**: Google OAuth memblokir WebView bawaan (WA/IG/FB/TikTok/LINE); pertahankan deteksi user-agent & tombol `intent://` ke Chrome di halaman login.
6. **UI & Design System (`DESIGN.md`)**: Gunakan token CSS dari `src/styles/tokens.css`, tinggi kontrol interaktif minimal `44px` (outdoor/mobile-friendly), dan transisi hanya pada `transform`, `opacity`, atau `background-color` (dilarang `transition: all`).

## 5. Perintah Kerja

```bash
bun run dev          # Jalankan dev server lokal
bun run check        # wrangler types --check + svelte-kit sync + svelte-check
bun run test         # Jalankan unit/route tests (vitest --run)
bun run build        # Build produksi Cloudflare Pages
bun run gen          # Update worker-configuration.d.ts (wajib setelah edit wrangler.jsonc)

# Migrasi & seed D1 lokal
bunx wrangler d1 execute db-petaniaga --local --file=./migrations/0001_initial_schema.sql
bunx wrangler d1 execute db-petaniaga --local --file=./migrations/seed_dev.sql
```
