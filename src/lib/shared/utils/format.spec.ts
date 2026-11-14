import { describe, expect, it } from 'vitest';
import {
	formatDistanceKm,
	formatRemainingDays,
	formatRupiah,
	formatWaDisplay,
	normalizeWaNumber
} from './format';

describe('format utils', () => {
	it('memformat harga ke Rupiah Indonesia', () => {
		expect(formatRupiah(15000)).toBe('Rp 15.000');
		expect(formatRupiah(0)).toBe('Rp 0');
		expect(formatRupiah(-500)).toBe('Rp 0');
	});

	it('menormalisasi nomor WhatsApp Indonesia secara konsisten', () => {
		expect(normalizeWaNumber('0812-3456-7890')).toBe('6281234567890');
		expect(normalizeWaNumber('+62 812 3456 7890')).toBe('6281234567890');
		expect(normalizeWaNumber('628567890123')).toBe('628567890123');
		expect(normalizeWaNumber('81234567890')).toBe('6281234567890');
		expect(normalizeWaNumber('021123456')).toBeNull();
		expect(normalizeWaNumber('08123')).toBeNull();
		expect(normalizeWaNumber('')).toBeNull();
	});

	it('memformat tampilan nomor WhatsApp dan sisa hari tayang', () => {
		expect(formatWaDisplay('6281234567890')).toBe('+62 812-3456-7890');
		expect(formatRemainingDays(1000 + 14 * 86400, 1000)).toBe('Aktif 14 hari');
		expect(formatRemainingDays(1000 + 3600, 1000)).toBe('Berakhir hari ini');
		expect(formatRemainingDays(900, 1000)).toBe('Kedaluwarsa');
	});

	it('menghitung jarak tampilan dalam meter atau kilometer', () => {
		expect(formatDistanceKm(-6.8174, 107.6172, -6.8174, 107.6172)).toBe('50 m');
		const dist = formatDistanceKm(-6.9175, 107.6191, -6.8174, 107.6172);
		expect(dist).toMatch(/km$/);
	});
});

