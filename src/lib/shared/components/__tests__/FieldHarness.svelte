<script lang="ts">
	import Field from '../Field.svelte';
	import Input from '../Input.svelte';

	let { hint, error = null }: { hint?: string; error?: string | null } = $props();

	let value = $state('12000');
</script>

<Field id="harga" label="Harga (Rp)" {hint} {error}>
	<Input id="harga" name="harga" bind:value />
</Field>
