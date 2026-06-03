import { json } from '@sveltejs/kit';
import db from '$lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const q = url.searchParams.get('q')?.trim() ?? '';
	const colorsParam = url.searchParams.get('colors');
	const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1'));
	const pageSize = 20;

	const where: Record<string, unknown> = {};

	if (q) {
		where.name = { contains: q, mode: 'insensitive' };
	}

	if (colorsParam) {
		const requestedColors = colorsParam.split(',').filter(Boolean);
		// Filter cards whose color_identity contains ALL requested colors
		where.AND = requestedColors.map((c) => ({
			color_identity: { contains: `"${c}"` }
		}));
	}

	const [cards, total] = await Promise.all([
		db.card.findMany({
			where,
			select: {
				id: true,
				name: true,
				mana_cost: true,
				cmc: true,
				type_line: true,
				colors: true,
				color_identity: true,
				rarity: true,
				cluster_id: true
			},
			orderBy: { name: 'asc' },
			skip: (page - 1) * pageSize,
			take: pageSize
		}),
		db.card.count({ where })
	]);

	return json({
		cards,
		total,
		page,
		totalPages: Math.ceil(total / pageSize),
		hasMore: page * pageSize < total
	});
};
