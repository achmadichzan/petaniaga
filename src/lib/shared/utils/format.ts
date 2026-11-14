/**
 * Memformat angka menjadi format mata uang Rupiah Indonesia.
 */
export function formatRupiah(amount: number): string {
	const rounded = Math.max(0, Math.round(amount));
	return `Rp ${rounded.toLocaleString('id-ID')}`;
}

/**
 * Menormalisasi nomor WhatsApp Indonesia (08..., +628..., 628...) menjadi format 628...
 * Mengembalikan null jika nomor tidak valid.
 */
export function normalizeWaNumber(raw: string): string | null {
	const digits = raw.replace(/\D+/g, '');
	if (!digits) return null;

	let normalized = digits;
	if (normalized.startsWith('08')) {
		normalized = `62${normalized.slice(1)}`;
	} else if (normalized.startsWith('8')) {
		normalized = `62${normalized}`;
	}

	if (!normalized.startsWith('628')) {
		return null;
	}

	if (normalized.length < 10 || normalized.length > 15) {
		return null;
	}

	return normalized;
}

/**
 * Memformat nomor WA `628123456789` menjadi tampilan yang mudah dibaca `+62 812-3456-789`.
 */
export function formatWaDisplay(wa: string): string {
	if (!wa) return '';
	const clean = wa.replace(/\D+/g, '');
	if (!clean.startsWith('62')) return wa;
	const local = clean.slice(2);
	return `+62 ${local.replace(/(\d{3})(\d{4})(\d+)/, '$1-$2-$3')}`;
}

/**
 * Menghitung sisa masa tayang produk dalam bahasa Indonesia.
 */
export function formatRemainingDays(
	expiredAtUnix: number,
	nowUnix = Math.floor(Date.now() / 1000)
): string {
	const diff = expiredAtUnix - nowUnix;
	if (diff <= 0) return 'Kedaluwarsa';
	const days = Math.ceil(diff / 86400);
	if (days <= 1) return 'Berakhir hari ini';
	return `Aktif ${days} hari`;
}

/**
 * Menghitung jarak antara dua titik koordinat di client (untuk label UI saja, bukan query SQL).
 */
export function formatDistanceKm(
	lat1: number,
	lng1: number,
	lat2: number,
	lng2: number
): string {
	const toRad = (deg: number) => (deg * Math.PI) / 180;
	const R = 6371;
	const dLat = toRad(lat2 - lat1);
	const dLng = toRad(lng2 - lng1);
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	const km = R * c;

	if (km < 1) {
		const meters = Math.max(50, Math.round((km * 1000) / 50) * 50);
		return `${meters} m`;
	}
	return `${km.toFixed(1).replace('.', ',')} km`;
}

