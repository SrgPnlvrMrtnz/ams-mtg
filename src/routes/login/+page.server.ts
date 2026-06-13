import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { hashPassword, verifyPassword, createJwt } from '$lib/server/auth';

export const load: PageServerLoad = ({ locals }) => {
	if (locals.user) {
		redirect(302, '/');
	}
};

interface UserRow {
	id: string;
	email: string;
	password: string;
}

export const actions: Actions = {
	login: async ({ request, cookies, platform }) => {
		const data = await request.formData();
		const email = data.get('email') as string;
		const password = data.get('password') as string;

		if (!email || !password) {
			return fail(400, { error: 'Email y contraseña son obligatorios' });
		}

		let user: UserRow | null;
		try {
			user = await platform!.env.ams_mtg_db
				.prepare('SELECT id, email, password FROM User WHERE email = ?')
				.bind(email)
				.first<UserRow>();
		} catch (e) {
			console.error('[login] error al buscar usuario en DB:', e);
			return fail(500, { error: 'Error interno. Por favor, inténtalo de nuevo.' });
		}

		if (!user) {
			return fail(401, { error: 'Credenciales incorrectas' });
		}

		let valid: boolean;
		try {
			valid = await verifyPassword(password, user.password);
		} catch (e) {
			console.error('[login] error al verificar contraseña:', e);
			return fail(500, { error: 'Error interno. Por favor, inténtalo de nuevo.' });
		}

		if (!valid) {
			return fail(401, { error: 'Credenciales incorrectas' });
		}

		const token = await createJwt(user.id, user.email);
		cookies.set('token', token, {
			path: '/',
			httpOnly: true,
			sameSite: 'strict',
			maxAge: 60 * 60 * 24 * 7
		});

		redirect(302, '/');
	},

	register: async ({ request, platform }) => {
		const data = await request.formData();
		const email = data.get('email') as string;
		const password = data.get('password') as string;
		const confirmPassword = data.get('confirmPassword') as string;

		if (!email || !password || !confirmPassword) {
			return fail(400, { error: 'Todos los campos son obligatorios' });
		}

		if (password.length < 8) {
			return fail(400, { error: 'La contraseña debe tener al menos 8 caracteres' });
		}

		if (password !== confirmPassword) {
			return fail(400, { error: 'Las contraseñas no coinciden' });
		}

		let existing: unknown;
		try {
			existing = await platform!.env.ams_mtg_db
				.prepare('SELECT id FROM User WHERE email = ?')
				.bind(email)
				.first();
		} catch (e) {
			console.error('[register] error al verificar email en DB:', e);
			return fail(500, { error: 'Error interno. Por favor, inténtalo de nuevo.' });
		}

		if (existing) {
			return fail(409, { error: 'Ya existe una cuenta con ese email' });
		}

		try {
			const id = crypto.randomUUID();
			const hashedPassword = await hashPassword(password);
			const now = new Date().toISOString();
			await platform!.env.ams_mtg_db
				.prepare('INSERT INTO User (id, email, password, createdAt) VALUES (?, ?, ?, ?)')
				.bind(id, email, hashedPassword, now)
				.run();
		} catch (e) {
			console.error('[register] error al crear usuario en DB:', e);
			return fail(500, { error: 'Error interno. Por favor, inténtalo de nuevo.' });
		}

		return { registered: true };
	}
};
