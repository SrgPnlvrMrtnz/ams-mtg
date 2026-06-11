import { PrismaClient } from '@prisma/client';
import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = resolve(__dirname, '../prisma/dev.db');
const OUT_DIR = resolve(__dirname, '../d1-import');
const BATCH_SIZE = 5000;

const db = new PrismaClient({ datasources: { db: { url: `file:${DB_PATH}` } } });

function escape(val) {
	if (val === null || val === undefined) return 'NULL';
	return `'${String(val).replace(/'/g, "''")}'`;
}

async function main() {
	await mkdir(OUT_DIR, { recursive: true });

	const total = await db.card.count();
	const numFiles = Math.ceil(total / BATCH_SIZE);
	console.log(`Exportando ${total} cartas en ${numFiles} archivo(s)...`);

	for (let i = 0; i < numFiles; i++) {
		const cards = await db.card.findMany({ skip: i * BATCH_SIZE, take: BATCH_SIZE });
		const filePath = `${OUT_DIR}/cards_${String(i + 1).padStart(2, '0')}.sql`;
		const stream = createWriteStream(filePath);

		for (const c of cards) {
			stream.write(
				`INSERT OR IGNORE INTO "Card" (id,name,mana_cost,cmc,type_line,oracle_text,power,toughness,loyalty,colors,color_identity,keywords,set_code,rarity,tags) VALUES (${escape(c.id)},${escape(c.name)},${escape(c.mana_cost)},${c.cmc},${escape(c.type_line)},${escape(c.oracle_text)},${escape(c.power)},${escape(c.toughness)},${escape(c.loyalty)},${escape(c.colors)},${escape(c.color_identity)},${escape(c.keywords)},${escape(c.set_code)},${escape(c.rarity)},${escape(c.tags)});\n`
			);
		}
		await new Promise((res, rej) => stream.end(err => (err ? rej(err) : res())));

		console.log(`  ✓ cards_${String(i + 1).padStart(2, '0')}.sql (${cards.length} cartas)`);
	}

	await db.$disconnect();
	console.log('\nListo. Aplica cada archivo con:');
	console.log(`  npx wrangler d1 execute ams-mtg-db --remote --file=d1-import/cards_01.sql`);
	console.log('  (repite para cada archivo)');
}

main().catch(e => { console.error(e); process.exit(1); });
