import { json, error } from '@sveltejs/kit';
import db from '$lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const card = await db.card.findUnique({ where: { id: params.id } });
	if (!card) throw error(404, 'Card not found');
	return json(card);
};
