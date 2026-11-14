import type { ProductCategory } from '#shared/constants/harvest.ts';

export interface BoundingBox {
	north: number;
	south: number;
	east: number;
	west: number;
}

export interface GeoPoint {
	lat: number;
	lng: number;
}

export interface MapProductItem {
	id: string;
	user_id: string;
	nama_produk: string;
	kategori: ProductCategory;
	harga: number;
	satuan: string;
	stok_info: string | null;
	foto_url: string;
	lat: number;
	lng: number;
	expired_at: number;
	created_at: number;
	penjual_nama: string;
	no_wa: string;
	is_open: number;
	jam_buka: string | null;
	jam_tutup: string | null;
}

export interface MapProductsQuery {
	bounds: BoundingBox;
	kategori?: ProductCategory | 'semua';
	zoom?: number;
}

export interface MapProductsResult {
	products: MapProductItem[];
	hasMore: boolean;
	zoomTooWide: boolean;
}
