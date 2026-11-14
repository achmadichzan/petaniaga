const FOCUSABLE =
	'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type InertElement = HTMLElement & { inert: boolean };

function isFocusable(el: HTMLElement): boolean {
	if (el.tabIndex < 0) return false;
	if (el.closest('[hidden], [inert]')) return false;
	if ('checkVisibility' in el && !el.checkVisibility()) return false;
	const style = getComputedStyle(el);
	return style.display !== 'none' && style.visibility !== 'hidden';
}

export function focusableIn(root: HTMLElement): HTMLElement[] {
	return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(isFocusable);
}

/**
 * Nonaktifkan sisa halaman selama dialog terbuka. Dialog harus sudah di-portal ke
 * <body> supaya elemen lain bisa di-inert tanpa ikut melumpuhkan dialognya.
 */
export function inertBackground(overlay: HTMLElement): () => void {
	const touched: InertElement[] = [];
	for (const child of Array.from(document.body.children) as InertElement[]) {
		if (child === overlay || child.tagName === 'SCRIPT' || child.tagName === 'STYLE') continue;
		if (!('inert' in child)) continue;
		child.inert = true;
		touched.push(child);
	}
	return () => {
		for (const el of touched) el.inert = false;
	};
}

/** Jaga Tab/Shift+Tab tetap berputar di dalam overlay. */
export function trapTab(event: KeyboardEvent, overlay: HTMLElement): void {
	if (event.key !== 'Tab') return;
	const items = focusableIn(overlay);
	if (!items.length) {
		event.preventDefault();
		return;
	}
	const first = items[0];
	const last = items[items.length - 1];
	const active = document.activeElement as HTMLElement | null;

	if (event.shiftKey && (active === first || !active || !overlay.contains(active))) {
		event.preventDefault();
		last.focus();
	} else if (!event.shiftKey && (active === last || !active || !overlay.contains(active))) {
		event.preventDefault();
		first.focus();
	}
}

export function focusInside(root: HTMLElement): void {
	const [first] = focusableIn(root);
	(first ?? root).focus();
}
