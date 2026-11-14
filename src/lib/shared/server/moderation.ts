/**
 * Moderasi foto produk dengan Workers AI (vision LLM).
 *
 * Model llama-3.2-11b-vision dipilih karena model llava-1.5-7b-hf sudah
 * dijadwalkan pensiun oleh Cloudflare (20 November 2026).
 */
const VISION_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';

const SAFETY_PROMPT = [
	'You are a content safety classifier for an agricultural marketplace.',
	'Does this image show human nudity, pornography, or sexually explicit content?',
	'Photos of raw fish, meat, livestock, plants, and agricultural harvest are allowed.',
	'Answer with exactly one word: YES or NO.'
].join(' ');

/**
 * Mendeteksi kemungkinan foto tidak senonoh.
 *
 * Fail-open: bila binding AI tidak tersedia (unit test / dev lokal) atau
 * layanan AI gangguan sementara / kuota Neurons habis, foto dianggap aman
 * agar penjual tidak kehilangan kesempatan menjual hanya karena masalah infra.
 */
export async function isUnsafeImage(ai: Ai | null, bytes: ArrayBuffer): Promise<boolean> {
	if (!ai) return false;

	try {
		const result = await ai.run(VISION_MODEL, {
			prompt: SAFETY_PROMPT,
			image: [...new Uint8Array(bytes)],
			max_tokens: 8,
			temperature: 0
		});

		const answer = String(result?.response ?? '')
			.trim()
			.toUpperCase();
		return answer.startsWith('YES');
	} catch (err) {
		console.warn('[moderation] Pemeriksaan Workers AI dilewati:', err);
		return false;
	}
}
