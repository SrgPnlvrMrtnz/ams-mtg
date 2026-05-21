import type { Handle } from '@sveltejs/kit';
import { verifyJwt } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
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
