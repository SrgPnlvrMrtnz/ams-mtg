import { PrismaClient } from '@prisma/client';
import { PrismaD1 } from '@prisma/adapter-d1';
import type { D1Database } from '@cloudflare/workers-types';

export function getDb(d1: D1Database): PrismaClient {
	return new PrismaClient({ adapter: new PrismaD1(d1) });
}
