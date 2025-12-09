import { timingSafeEqual } from 'node:crypto';

interface AdminAuthConfig {
    username: string;
    password: string;
}

export class AdminAuthenticator {
    private usernameBuffer: Buffer;
    private passwordBuffer: Buffer;

    constructor(config: AdminAuthConfig) {
        this.usernameBuffer = Buffer.from(config.username, 'utf-8');
        this.passwordBuffer = Buffer.from(config.password, 'utf-8');
    }

    authenticate(username: string, password: string): boolean {
        try {
            const incomingUsernameBuffer = Buffer.from(username, 'utf-8');
            const incomingPasswordBuffer = Buffer.from(password, 'utf-8');

            const usernameMatch = this.safeBufferEqual(
                incomingUsernameBuffer,
                this.usernameBuffer,
            );
            const passwordMatch = this.safeBufferEqual(
                incomingPasswordBuffer,
                this.passwordBuffer,
            );

            return usernameMatch && passwordMatch;
        } catch {
            return false;
        }
    }

    private safeBufferEqual(a: Buffer, b: Buffer): boolean {
        if (a.length !== b.length) return false;

        try {
            return timingSafeEqual(a, b);
        } catch {
            return false;
        }
    }
}

export function createAdminAuthenticator(
    username: string,
    password: string,
): AdminAuthenticator {
    return new AdminAuthenticator({ username, password });
}

export function parseBasicAuth(
    authHeader: string,
): { username: string; password: string } | null {
    try {
        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Basic') return null;

        const decoded = Buffer.from(parts[1], 'base64').toString('utf-8');
        const [username, password] = decoded.split(':', 2);

        if (!username || !password) return null;

        return { username, password };
    } catch {
        return null;
    }
}
