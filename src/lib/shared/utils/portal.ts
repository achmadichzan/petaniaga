/**
 * Pindahkan elemen ke <body> supaya popover tidak terpotong atau tertutup oleh
 * stacking context leluhurnya (pane ber-scroll, pane peta Leaflet, dsb).
 * Pasangkan dengan `position: fixed` dan koordinat dari anchor.
 */
export function portal(node: HTMLElement) {
	const target = document.body;
	target.appendChild(node);

	return {
		destroy() {
			node.remove();
		}
	};
}
