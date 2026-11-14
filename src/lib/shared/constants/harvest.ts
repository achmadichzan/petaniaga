/**
 * Marker hues are declared in tokens.css as `--color-cat-*`, so the pin border and
 * icon keep following the design system instead of carrying their own hex values.
 */
export const PRODUCT_CATEGORIES = [
	{ value: 'sayur', label: 'Sayuran', color: 'var(--color-cat-sayur)' },
	{ value: 'beras', label: 'Beras & Padi', color: 'var(--color-cat-beras)' },
	{ value: 'buah', label: 'Buah-buahan', color: 'var(--color-cat-buah)' },
	{ value: 'umbi', label: 'Umbi & Palawija', color: 'var(--color-cat-umbi)' },
	{ value: 'laut', label: 'Ikan & Laut', color: 'var(--color-cat-laut)' },
	{ value: 'olahan', label: 'Olahan UMKM', color: 'var(--color-cat-olahan)' },
	{ value: 'lainnya', label: 'Lainnya', color: 'var(--color-cat-lainnya)' }
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number]['value'];

export const PRODUCT_UNITS = ['kg', 'ikat', 'karung', 'ton', 'buah', 'pack'] as const;

export type ProductUnit = (typeof PRODUCT_UNITS)[number];

export const PRODUCT_EXPIRY_DAYS = 14;
export const PRODUCT_EXPIRY_SECONDS = PRODUCT_EXPIRY_DAYS * 24 * 60 * 60;

export function isValidCategory(value: string): value is ProductCategory {
	return PRODUCT_CATEGORIES.some((c) => c.value === value);
}

export function isValidUnit(value: string): value is ProductUnit {
	return (PRODUCT_UNITS as readonly string[]).includes(value);
}

export function getCategoryMeta(category: string) {
	return (
		PRODUCT_CATEGORIES.find((c) => c.value === category) ??
		PRODUCT_CATEGORIES[PRODUCT_CATEGORIES.length - 1]
	);
}

