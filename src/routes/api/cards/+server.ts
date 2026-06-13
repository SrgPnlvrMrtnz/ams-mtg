import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface CardRow {
	id: string;
	name: string;
	mana_cost: string | null;
	cmc: number;
	type_line: string;
	colors: string;
	color_identity: string;
	rarity: string | null;
	tags: string;
}

export const GET: RequestHandler = async ({ url, platform }) => {
	const d1 = platform!.env.ams_mtg_db;
	const q = url.searchParams.get('q')?.trim() ?? '';
	const colorsParam = url.searchParams.get('colors');
	const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
	const pageSize = 20;
	const offset = (page - 1) * pageSize;

	const conditions: string[] = [];
	const bindings: (string | number)[] = [];

	if (q) {
		conditions.push('name LIKE ?');
		bindings.push(`%${q}%`);
	}

	if (colorsParam) {
		for (const c of colorsParam.split(',').filter(Boolean)) {
			conditions.push('color_identity LIKE ?');
			bindings.push(`%"${c}"%`);
		}
	}

	const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

	const [cardsResult, countResult] = await Promise.all([
		d1
			.prepare(
				`SELECT id, name, mana_cost, cmc, type_line, colors, color_identity, rarity, tags FROM Card ${where} ORDER BY name ASC LIMIT ? OFFSET ?`
			)
			.bind(...bindings, pageSize, offset)
			.all<CardRow>(),
		d1
			.prepare(`SELECT COUNT(*) as count FROM Card ${where}`)
			.bind(...bindings)
			.first<{ count: number }>()
	]);

	const cards = cardsResult.results;
	const total = countResult?.count ?? 0;

	return json({
		cards,
		total,
		page,
		totalPages: Math.ceil(total / pageSize),
		hasMore: page * pageSize < total
	});
};
