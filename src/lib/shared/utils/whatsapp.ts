import { formatRupiah } from './format';

export interface WhatsAppOrderParams {
	noWa: string;
	namaPenjual: string;
	namaProduk: string;
	harga: number;
	satuan: string;
}

export interface InAppBrowserInfo {
	isInApp: boolean;
	appName: string | null;
	isAndroid: boolean;
	isIOS: boolean;
}

/**
 * Membuat tautan Direct WhatsApp (`wa.me`) beserta pesan pesanan otomatis.
 */
export function buildWhatsAppOrderUrl(params: WhatsAppOrderParams): string {
	const cleanWa = params.noWa.replace(/\D+/g, '');
	const message =
		`Halo ${params.namaPenjual}, saya tertarik membeli *${params.namaProduk}* ` +
		`(${formatRupiah(params.harga)}/${params.satuan}) yang saya lihat di Petaniaga. ` +
		`Apakah stoknya masih tersedia?`;
	return `https://wa.me/${cleanWa}?text=${encodeURIComponent(message)}`;
}

/**
 * Mendeteksi apakah halaman dibuka di dalam In-App Browser (WA, Facebook, IG, TikTok, Line)
 * yang memblokir Google OAuth (`disallowed_useragent`).
 */
export function detectInAppBrowser(userAgent: string): InAppBrowserInfo {
	const ua = userAgent || '';
	const isAndroid = /Android/i.test(ua);
	const isIOS = /iPhone|iPad|iPod/i.test(ua);

	if (/WhatsApp/i.test(ua)) {
		return { isInApp: true, appName: 'WhatsApp', isAndroid, isIOS };
	}
	if (/FBAN|FBAV|FB_IAB/i.test(ua)) {
		return { isInApp: true, appName: 'Facebook', isAndroid, isIOS };
	}
	if (/Instagram/i.test(ua)) {
		return { isInApp: true, appName: 'Instagram', isAndroid, isIOS };
	}
	if (/Line\//i.test(ua)) {
		return { isInApp: true, appName: 'LINE', isAndroid, isIOS };
	}
	if (/BytedanceWebview|TikTok|musical_ly/i.test(ua)) {
		return { isInApp: true, appName: 'TikTok', isAndroid, isIOS };
	}
	if (isAndroid && /\bwv\b/i.test(ua)) {
		return { isInApp: true, appName: 'Browser Aplikasi', isAndroid, isIOS };
	}

	return { isInApp: false, appName: null, isAndroid, isIOS };
}

/**
 * Membuat URL `intent://` agar Android otomatis membuka halaman di Google Chrome.
 */
export function buildAndroidChromeIntentUrl(currentUrl: string): string {
	try {
		const parsed = new URL(currentUrl);
		const scheme = parsed.protocol.replace(':', '') || 'https';
		return `intent://${parsed.host}${parsed.pathname}${parsed.search}#Intent;scheme=${scheme};package=com.android.chrome;end`;
	} catch {
		return currentUrl;
	}
}

