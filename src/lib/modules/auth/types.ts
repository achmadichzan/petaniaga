export interface SellerUser {
	id: string;
	nama: string;
	email: string;
	no_wa: string | null;
	default_lat: number | null;
	default_lng: number | null;
	is_open: number;
	jam_buka: string | null;
	jam_tutup: string | null;
	strike_count: number;
	is_banned: number;
	created_at: number;
}

export interface SessionUser {
	id: string;
	nama: string;
	no_wa: string | null;
	default_lat: number | null;
	default_lng: number | null;
	is_open?: number;
	jam_buka?: string | null;
	jam_tutup?: string | null;
}

export interface GoogleProfile {
	id: string;
	nama: string;
	email: string;
}

