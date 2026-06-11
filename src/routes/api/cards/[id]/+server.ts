import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
	const card = await locals.db.card.findUnique({ where: { id: params.id } });
	if (!card) throw error(404, 'Card not found');
	return json(card);
};
