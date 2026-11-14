import type { SessionUser } from '#modules/auth/types.ts';

declare global {
	namespace App {
		interface Locals {
			user: SessionUser | null;
		}
	}

	namespace Cloudflare {
		interface Env {
			GOOGLE_CLIENT_ID?: string;
			GOOGLE_CLIENT_SECRET?: string;
			JWT_SECRET?: string;
			APP_URL?: string;
			ENABLE_DEV_LOGIN?: string;
			ADMIN_EMAILS?: string;
		}
	}
}

export {};
