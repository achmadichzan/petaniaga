import type { ProductCategory } from '#shared/constants/harvest.ts';

export interface ProductRecord {
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
	is_available: number;
	expired_at: number;
	created_at: number;
}

export interface CreateProductInput {
	nama_produk: string;
	kategori: string;
	harga: number;
	satuan: string;
	stok_info?: string | null;
	lat: number;
	lng: number;
	photoFile: File;
}
