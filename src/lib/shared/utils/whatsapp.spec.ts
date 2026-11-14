import { describe, expect, it } from 'vitest';
import {
	buildAndroidChromeIntentUrl,
	buildWhatsAppOrderUrl,
	detectInAppBrowser
} from './whatsapp';

describe('whatsapp utils', () => {
	it('membuat URL wa.me beserta pesan pesanan otomatis', () => {
		const url = buildWhatsAppOrderUrl({
			noWa: '6281234567890',
			namaPenjual: 'Pak Budi',
			namaProduk: 'Beras Rojo Lele',
			harga: 14500,
			satuan: 'kg'
		});

		expect(url.startsWith('https://wa.me/6281234567890?text=')).toBe(true);
		const decoded = decodeURIComponent(url.split('?text=')[1]);
		expect(decoded).toContain('Pak Budi');
		expect(decoded).toContain('*Beras Rojo Lele*');
		expect(decoded).toContain('Rp 14.500/kg');
	});

	it('mendeteksi In-App Browser WhatsApp, Facebook, Instagram, dan TikTok', () => {
		expect(
			detectInAppBrowser('Mozilla/5.0 (Linux; Android 14) WhatsApp/2.24.1 N')
		).toEqual({
			isInApp: true,
			appName: 'WhatsApp',
			isAndroid: true,
			isIOS: false
		});

		expect(
			detectInAppBrowser('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) FBAN/FBIOS;FBAV/440')
		).toEqual({
			isInApp: true,
			appName: 'Facebook',
			isAndroid: false,
			isIOS: true
		});

		expect(
			detectInAppBrowser('Mozilla/5.0 (Linux; Android 13) Chrome/120.0.0.0 Mobile Safari/537.36')
		).toEqual({
			isInApp: false,
			appName: null,
			isAndroid: true,
			isIOS: false
		});
	});

	it('membuat intent URL Chrome untuk Android', () => {
		expect(buildAndroidChromeIntentUrl('https://temutani.pages.dev/login?ref=wa')).toBe(
			'intent://temutani.pages.dev/login?ref=wa#Intent;scheme=https;package=com.android.chrome;end'
		);
	});
});

