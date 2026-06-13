import type { Handle } from '@sveltejs/kit';
import { verifyJwt } from '$lib/server/auth';
import { getDb } from '$lib/server/db';

export const handle: Handle = async ({ event, resolve }) => {
	event.locals.db = getDb(event.platform!.env.ams_mtg_db);

	const token = event.cookies.get('token') ?? null;
	event.locals.user = null;

	if (token) {
		const payload = await verifyJwt(token);
		if (payload) {
			event.locals.user = { id: payload.userId, email: payload.email };
		}
	}

	return resolve(event);
};
