import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const db = locals.db;
	const card = await db.card.findUnique({
		where: { id: params.id },
		select: { tags: true }
	});

	if (!card) throw error(404, 'Card not found');

	const tags: string[] = JSON.parse(card.tags);

	if (tags.length === 0) {
		return json({ cards: [] });
	}

	const tagConditions = tags.map((t) => `(tags LIKE '%"${t}"%')`).join(' + ');

	const similar = await db.$queryRawUnsafe<
		{
			id: string;
			name: string;
			mana_cost: string | null;
			cmc: number;
			type_line: string;
			colors: string;
			rarity: string | null;
			tags: string;
		}[]
	>(
		`SELECT id, name, mana_cost, cmc, type_line, colors, rarity, tags
		 FROM "Card"
		 WHERE id != ? AND tags != '[]' AND type_line NOT LIKE '%Land%'
		 ORDER BY (${tagConditions}) DESC
		 LIMIT 6`,
		params.id
	);

	return json({ cards: similar });
};
