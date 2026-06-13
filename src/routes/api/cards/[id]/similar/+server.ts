import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, platform }) => {
	const d1 = platform!.env.ams_mtg_db;

	const card = await d1
		.prepare('SELECT tags FROM Card WHERE id = ?')
		.bind(params.id)
		.first<{ tags: string }>();

	if (!card) throw error(404, 'Card not found');

	const tags: string[] = JSON.parse(card.tags);

	if (tags.length === 0) {
		return json({ cards: [] });
	}

	const tagConditions = tags.map((t) => `(tags LIKE '%"${t}"%')`).join(' + ');

	const result = await d1
		.prepare(
			`SELECT id, name, mana_cost, cmc, type_line, colors, rarity, tags
			 FROM Card
			 WHERE id != ? AND tags != '[]' AND type_line NOT LIKE '%Land%'
			 ORDER BY (${tagConditions}) DESC
			 LIMIT 6`
		)
		.bind(params.id)
		.all<{
			id: string;
			name: string;
			mana_cost: string | null;
			cmc: number;
			type_line: string;
			colors: string;
			rarity: string | null;
			tags: string;
		}>();

	return json({ cards: result.results });
};
