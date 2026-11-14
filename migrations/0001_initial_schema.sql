-- 1. Tabel Penjual
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,              -- Diisi dengan Google 'sub' ID
    nama TEXT NOT NULL,
    email TEXT NOT NULL,
    no_wa TEXT,                       -- Format: 628123456789
    default_lat REAL,
    default_lng REAL,
    is_open INTEGER NOT NULL DEFAULT 1, -- 1 = lapak buka, 0 = tutup manual
    jam_buka TEXT,                      -- Format HH:MM (WIB)
    jam_tutup TEXT,                     -- Format HH:MM (WIB)
    strike_count INTEGER NOT NULL DEFAULT 0, -- Jumlah pelanggaran foto terdeteksi AI
    is_banned INTEGER NOT NULL DEFAULT 0,    -- 1 = akun dinonaktifkan, lapak disembunyikan
    created_at INTEGER DEFAULT (unixepoch())
);

-- 2. Tabel Produk Panen
CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,              -- Diisi dengan crypto.randomUUID()
    user_id TEXT NOT NULL,
    nama_produk TEXT NOT NULL,
    kategori TEXT NOT NULL,           -- 'sayur', 'beras', 'buah', 'umbi', 'lainnya'
    harga INTEGER NOT NULL,           -- Harga Rupiah per satuan
    satuan TEXT NOT NULL,             -- 'kg', 'ikat', 'karung', 'ton', 'buah', 'pack'
    stok_info TEXT,
    foto_url TEXT NOT NULL,           -- URL foto (proxy R2 /api/photos/... atau domain publik R2)
    lat REAL NOT NULL,
    lng REAL NOT NULL,
    is_available INTEGER NOT NULL DEFAULT 1, -- 1 = tersedia, 0 = stok habis
    expired_at INTEGER NOT NULL,      -- Unix timestamp (+14 hari dari waktu dibuat)
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Index gabungan wajib agar scan peta di D1 super hemat kuota Read
CREATE INDEX IF NOT EXISTS idx_peta_produk
ON products (is_available, lat, lng, expired_at);

-- Index untuk halaman dashboard penjual
CREATE INDEX IF NOT EXISTS idx_produk_penjual
ON products (user_id, created_at DESC);

-- Nomor WhatsApp unik per akun (mengabaikan NULL sebelum onboarding)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_no_wa
ON users (no_wa) WHERE no_wa IS NOT NULL;

-- 3. Laporan foto produk dari pembeli
-- reporter_token: token anonim per perangkat (cookie) untuk menghitung pelapor unik
CREATE TABLE IF NOT EXISTS product_reports (
    id TEXT PRIMARY KEY,              -- Diisi dengan crypto.randomUUID()
    product_id TEXT NOT NULL,
    user_id TEXT NOT NULL,            -- Pemilik produk (penjual yang dilaporkan)
    reporter_token TEXT NOT NULL,     -- Token unik perangkat pelapor
    created_at INTEGER DEFAULT (unixepoch()),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Satu pelapor hanya dihitung sekali per produk
CREATE UNIQUE INDEX IF NOT EXISTS idx_laporan_unik
ON product_reports (product_id, reporter_token);

-- Hitung pelapor unik per penjual
CREATE INDEX IF NOT EXISTS idx_laporan_penjual
ON product_reports (user_id);

-- 4. Rate limit fixed-window untuk endpoint publik (mis. laporan foto)
CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY,             -- contoh: 'report:token:<uuid>' atau 'report:ip:<ip>'
    window_start INTEGER NOT NULL,    -- Awal jendela waktu (unix)
    count INTEGER NOT NULL DEFAULT 0
);

