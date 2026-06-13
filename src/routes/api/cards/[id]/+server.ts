import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, platform }) => {
	const card = await platform!.env.ams_mtg_db
		.prepare('SELECT * FROM Card WHERE id = ?')
		.bind(params.id)
		.first();
	if (!card) throw error(404, 'Card not found');
	return json(card);
};
