import { PrismaClient } from '@prisma/client';
import { join } from 'path';

const db = new PrismaClient({
	datasources: { db: { url: `file:${join(process.cwd(), 'prisma/dev.db')}` } }
});

export default db;
