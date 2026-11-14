import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/svelte';

// jsdom tidak punya implementasi layout, jadi beberapa API browser distub sederhana.
if (!('checkVisibility' in HTMLElement.prototype)) {
	Object.defineProperty(HTMLElement.prototype, 'checkVisibility', {
		configurable: true,
		value(this: HTMLElement) {
			return !this.closest('[hidden]');
		}
	});
}

if (!('inert' in HTMLElement.prototype)) {
	Object.defineProperty(HTMLElement.prototype, 'inert', {
		configurable: true,
		get(this: HTMLElement) {
			return this.hasAttribute('inert');
		},
		set(this: HTMLElement, value: boolean) {
			if (value) this.setAttribute('inert', '');
			else this.removeAttribute('inert');
		}
	});
}

afterEach(() => {
	cleanup();
	document.body.innerHTML = '';
});
