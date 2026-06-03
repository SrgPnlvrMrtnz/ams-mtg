import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const EXCLUDED_LAYOUTS = new Set(['token', 'art_series', 'double_faced_token', 'emblem']);
const BATCH_SIZE = 500;

async function getBulkDataUrl() {
	const res = await fetch('https://api.scryfall.com/bulk-data');
	if (!res.ok) throw new Error(`Scryfall bulk-data error: ${res.status}`);
	const json = await res.json();
	const entry = json.data.find((d) => d.type === 'oracle_cards');
	if (!entry) throw new Error('oracle_cards bulk data not found');
	return entry.download_uri;
}

function mapCard(card) {
	return {
		id: card.oracle_id,
		name: card.name,
		mana_cost: card.mana_cost ?? null,
		cmc: typeof card.cmc === 'number' && isFinite(card.cmc) ? card.cmc : 0,
		type_line: card.type_line ?? '',
		oracle_text: card.oracle_text ?? null,
		power: card.power ?? null,
		toughness: card.toughness ?? null,
		loyalty: card.loyalty ?? null,
		colors: JSON.stringify(Array.isArray(card.colors) ? card.colors : []),
		color_identity: JSON.stringify(Array.isArray(card.color_identity) ? card.color_identity : []),
		keywords: JSON.stringify(Array.isArray(card.keywords) ? card.keywords : []),
		set_code: card.set ?? null,
		rarity: card.rarity ?? null
	};
}

async function importCards() {
	console.log('Fetching bulk data URL from Scryfall...');
	const url = await getBulkDataUrl();
	console.log(`Downloading oracle_cards from: ${url}`);

	const res = await fetch(url);
	if (!res.ok) throw new Error(`Download error: ${res.status}`);

	const cards = await res.json();
	console.log(`Downloaded ${cards.length} cards. Filtering and importing...`);

	const filtered = cards.filter(
		(c) => !EXCLUDED_LAYOUTS.has(c.layout) && c.lang === 'en' && c.oracle_id
	);
	console.log(`After filtering: ${filtered.length} cards to import.`);

	let imported = 0;
	for (let i = 0; i < filtered.length; i += BATCH_SIZE) {
		const batch = filtered.slice(i, i + BATCH_SIZE).map(mapCard);
		try {
			await prisma.card.createMany({ data: batch });
		} catch (e) {
			const msg = e?.message ?? String(e);
			// Extract the error reason (last non-empty line after the data dump)
			const lines = msg.split('\n').filter((l) => l.trim());
			const reason = lines.slice(-5).join('\n');
			console.error(`\nBatch error at index ${i}:\n${reason}`);
			throw e;
		}
		imported += batch.length;
		process.stdout.write(`\rImported ${imported} / ${filtered.length}`);
	}

	console.log(`\nDone. Total cards in DB: ${await prisma.card.count()}`);
}

importCards()
	.catch((e) => {
		console.error(e);
		process.exit(1);
	})
	.finally(() => prisma.$disconnect());
