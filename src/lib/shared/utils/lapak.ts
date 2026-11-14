const TIME_HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isValidTimeHHMM(value: string): boolean {
	return TIME_HHMM_RE.test(value);
}

export function getIndonesianTimezone(lng?: number | null): {
	timeZone: string;
	label: 'WIB' | 'WITA' | 'WIT';
} {
	if (typeof lng === 'number' && Number.isFinite(lng)) {
		if (lng >= 126.5) return { timeZone: 'Asia/Jayapura', label: 'WIT' };
		if (lng >= 114.5) return { timeZone: 'Asia/Makassar', label: 'WITA' };
	}
	return { timeZone: 'Asia/Jakarta', label: 'WIB' };
}

function getCurrentHHMM(timeZone: string, now: Date): string {
	return new Intl.DateTimeFormat('en-GB', {
		timeZone,
		hour: '2-digit',
		minute: '2-digit',
		hour12: false
	}).format(now);
}

export function isLapakOpenNow(
	isOpen: number | undefined,
	jamBuka: string | null | undefined,
	jamTutup: string | null | undefined,
	lng?: number | null,
	now = new Date()
): boolean {
	if (isOpen === 0) return false;
	if (!jamBuka || !jamTutup) return true;
	if (!isValidTimeHHMM(jamBuka) || !isValidTimeHHMM(jamTutup)) return true;

	const { timeZone } = getIndonesianTimezone(lng);
	const current = getCurrentHHMM(timeZone, now);
	if (jamBuka <= jamTutup) {
		return current >= jamBuka && current <= jamTutup;
	}
	return current >= jamBuka || current <= jamTutup;
}

export function getLapakStatus(
	isOpen: number | undefined,
	jamBuka: string | null | undefined,
	jamTutup: string | null | undefined,
	lng?: number | null,
	now = new Date()
): { open: boolean; label: string; schedule: string | null; tzLabel: 'WIB' | 'WITA' | 'WIT' } {
	const { label: tzLabel } = getIndonesianTimezone(lng);
	const open = isLapakOpenNow(isOpen, jamBuka, jamTutup, lng, now);
	const schedule = jamBuka && jamTutup ? `${jamBuka}–${jamTutup} ${tzLabel}` : null;

	if (isOpen === 0) {
		return { open: false, label: 'Lapak Tutup', schedule, tzLabel };
	}
	if (!open) {
		return { open: false, label: 'Di Luar Jam Buka', schedule, tzLabel };
	}
	return { open: true, label: 'Buka', schedule, tzLabel };
}
