import bcrypt from 'bcryptjs';
import db from './db';

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

export async function hashPassword(password: string): Promise<string> {
	return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
	return bcrypt.compare(password, hash);
}

export async function createSession(userId: string) {
	const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
	return db.session.create({
		data: { userId, expiresAt }
	});
}

export async function getSessionUser(sessionId: string) {
	const session = await db.session.findUnique({
		where: { id: sessionId },
		include: { user: true }
	});

	if (!session || session.expiresAt < new Date()) {
		if (session) await db.session.delete({ where: { id: sessionId } });
		return null;
	}

	return session.user;
}

export async function deleteSession(sessionId: string): Promise<void> {
	await db.session.deleteMany({ where: { id: sessionId } });
}
