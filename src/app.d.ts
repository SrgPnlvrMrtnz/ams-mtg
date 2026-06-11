import type { PrismaClient } from '@prisma/client';
import type { D1Database } from '@cloudflare/workers-types';

declare global {
	namespace App {
		interface Locals {
			user: { id: string; email: string } | null;
			db: PrismaClient;
		}
		interface Platform {
			env: {
				ams_mtg_db: D1Database;
				JWT_SECRET: string;
				GROQ_API_KEY: string;
			};
		}
	}
}

export {};
