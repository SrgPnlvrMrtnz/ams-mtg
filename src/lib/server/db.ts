import { PrismaClient } from '@prisma/client';
import { PrismaD1 } from '@prisma/adapter-d1';
import type { D1Database } from '@cloudflare/workers-types';

let cachedClient: PrismaClient | null = null;

export function getDb(d1: D1Database): PrismaClient {
	if (!cachedClient) {
		cachedClient = new PrismaClient({ adapter: new PrismaD1(d1) });
	}
	return cachedClient;
}
