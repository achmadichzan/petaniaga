<script lang="ts">
	export type IconName =
		| 'sprout'
		| 'pin'
		| 'all'
		| 'sayur'
		| 'beras'
		| 'buah'
		| 'umbi'
		| 'laut'
		| 'olahan'
		| 'lainnya'
		| 'whatsapp'
		| 'map'
		| 'camera'
		| 'search'
		| 'user'
		| 'chevron'
		| 'check';

	interface Props {
		name: IconName;
		class?: string;
	}

	let { name, class: className = 'h-4 w-4 shrink-0' }: Props = $props();
</script>

<svg
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="1.75"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
	class={className}
>
	{#if name === 'sprout'}
		<path d="M7 20h10" />
		<path d="M10 20c5.5-2.5.8-6.4 3-10" />
		<path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z" />
		<path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z" />
	{:else if name === 'pin'}
		<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
		<circle cx="12" cy="10" r="3" />
	{:else if name === 'all'}
		<rect x="3" y="3" width="7" height="7" rx="1.5" />
		<rect x="14" y="3" width="7" height="7" rx="1.5" />
		<rect x="3" y="14" width="7" height="7" rx="1.5" />
		<rect x="14" y="14" width="7" height="7" rx="1.5" />
	{:else if name === 'sayur'}
		<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z" />
		<path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12" />
	{:else if name === 'beras'}
		<path d="M2 22 16 8" />
		<path d="M3.47 12.53 5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z" />
		<path d="M7.47 8.53 9 7l1.53 1.53a3.5 3.5 0 0 1 0 4.94L9 15l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z" />
		<path d="M11.47 4.53 13 3l1.53 1.53a3.5 3.5 0 0 1 0 4.94L13 11l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z" />
	{:else if name === 'buah'}
		<path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z" />
		<path d="M10 2c1 .5 2 2 2 5" />
	{:else if name === 'umbi'}
		<path d="M12 3c-2.5 0-4.5 2-4.5 5 0 4 2 9 4.5 13 2.5-4 4.5-9 4.5-13 0-3-2-5-4.5-5Z" />
		<path d="M10 9h2" />
		<path d="M12 13h2" />
	{:else if name === 'laut'}
		<path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.47-3.44 6-7 6-3.56 0-7.56-2.53-8.5-6Z" />
		<path d="M18 12v.5" />
		<path d="M6.5 12 2 9v6l4.5-3Z" />
	{:else if name === 'olahan'}
		<path d="M8 3h8" />
		<path d="M7 7h10l1 13H6L7 7Z" />
		<path d="M10 3v4" />
		<path d="M14 3v4" />
	{:else if name === 'lainnya'}
		<path d="M5 10h14l-1.5 9h-11Z" />
		<path d="M3 10h18" />
		<path d="m9 10 3-6 3 6" />
	{:else if name === 'whatsapp'}
		<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
	{:else if name === 'map'}
		<polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
		<line x1="9" x2="9" y1="3" y2="18" />
		<line x1="15" x2="15" y1="6" y2="21" />
	{:else if name === 'camera'}
		<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
		<circle cx="12" cy="13" r="3" />
	{:else if name === 'search'}
		<circle cx="11" cy="11" r="8" />
		<path d="m21 21-4.3-4.3" />
	{:else if name === 'user'}
		<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
		<circle cx="12" cy="7" r="4" />
	{:else if name === 'chevron'}
		<path d="m6 9 6 6 6-6" />
	{:else if name === 'check'}
		<path d="m20 6-11 11-5-5" />
	{/if}
</svg>
