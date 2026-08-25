import { timingSafeEqual } from 'node:crypto';

interface AdminAuthConfig {
    username: string;
    password: string;
}

/**
 * Compares admin credentials byte-by-byte so response timing cannot be used to guess them.
 *
 * Credentials come from environment variables only. A deployment with several admins should
 * move to hashed credentials in a database (bcrypt/argon2) instead of extending this.
 */
export class AdminAuthenticator {
    private usernameBuffer: Buffer;
    private passwordBuffer: Buffer;

    constructor(config: AdminAuthConfig) {
        this.usernameBuffer = Buffer.from(config.username, 'utf-8');
        this.passwordBuffer = Buffer.from(config.password, 'utf-8');
    }

    authenticate(username: string, password: string): boolean {
        const usernameMatch = this.safeBufferEqual(Buffer.from(username, 'utf-8'), this.usernameBuffer);
        const passwordMatch = this.safeBufferEqual(Buffer.from(password, 'utf-8'), this.passwordBuffer);

        return usernameMatch && passwordMatch;
    }

    private safeBufferEqual(a: Buffer, b: Buffer): boolean {
        // timingSafeEqual throws on a length mismatch, and the length is not a secret anyway.
        if (a.length !== b.length) return false;
        return timingSafeEqual(a, b);
    }
}

export function createAdminAuthenticator(
    username: string,
    password: string,
): AdminAuthenticator {
    return new AdminAuthenticator({ username, password });
}
