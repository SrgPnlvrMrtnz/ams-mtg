import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

const PUBLIC_PATHS = ['/login'];

export const load: LayoutServerLoad = ({ locals, url }) => {
	if (!locals.user && !PUBLIC_PATHS.includes(url.pathname)) {
		redirect(302, '/login');
	}
};
