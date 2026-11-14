-- Data contoh untuk pengujian peta lokal (D1 local)
INSERT OR IGNORE INTO users (id, nama, email, no_wa, default_lat, default_lng, is_open, jam_buka, jam_tutup)
VALUES
    ('seed-seller-1', 'Pak Budi Santoso', 'budi.tani@example.com', '6281234567890', -6.8215, 107.6191, 1, '05:30', '17:00'),
    ('seed-seller-2', 'Bu Siti Aminah', 'siti.tani@example.com', '6285678901234', -7.5622, 110.8282, 1, '15:00', '21:00'),
    ('seed-seller-3', 'Mas Hendra Wijaya', 'hendra.tani@example.com', '6281987654321', -7.8753, 112.5276, 0, '07:00', '16:00');

INSERT OR IGNORE INTO products (
    id, user_id, nama_produk, kategori, harga, satuan, stok_info, foto_url, lat, lng, is_available, expired_at
)
VALUES
    (
        '00000000-0000-4000-8000-000000000001',
        'seed-seller-1',
        'Kubis & Sawi Organik Lembang',
        'sayur',
        8500,
        'kg',
        'Panen subuh tadi, segar 80 kg di kebun',
        '/seed-photos/sayur-lembang.svg',
        -6.8174,
        107.6172,
        1,
        unixepoch() + 1209600
    ),
    (
        '00000000-0000-4000-8000-000000000002',
        'seed-seller-2',
        'Beras Rojo Lele Delanggu Baru Panen',
        'beras',
        14500,
        'kg',
        'Giling baru, bebas pemutih, minimal 5 kg',
        '/seed-photos/beras-delanggu.svg',
        -7.6184,
        110.6928,
        1,
        unixepoch() + 1209600
    ),
    (
        '00000000-0000-4000-8000-000000000003',
        'seed-seller-3',
        'Apel Manalagi Batu Petik Kebun',
        'buah',
        18000,
        'kg',
        'Manis renyah langsung dari pohon',
        '/seed-photos/apel-batu.svg',
        -7.8671,
        112.5239,
        1,
        unixepoch() + 1209600
    ),
    (
        '00000000-0000-4000-8000-000000000004',
        'seed-seller-1',
        'Ubi Cilembu Madu Mentah',
        'umbi',
        11000,
        'kg',
        'Siap oven/bakar, stok 120 kg',
        '/seed-photos/ubi-cilembu.svg',
        -6.9061,
        107.8355,
        1,
        unixepoch() + 1209600
    );
