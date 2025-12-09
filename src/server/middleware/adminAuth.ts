import { timingSafeEqual } from 'node:crypto';

interface AdminAuthConfig {
    username: string;
    password: string;
}

/**
 * AdminAuthenticator
 *
 * Timing-safe comparison for admin credentials.
 * Credentials are obtained from environment variables and compared byte-by-byte
 * to prevent timing attacks that could leak information about the correct credentials.
 *
 * SECURITY NOTES:
 * - Passwords are provided as environment variables only (e.g., ADMIN_PASSWORD)
 * - Both username and password are compared using crypto.timingSafeEqual()
 * - This prevents attackers from using timing differences to guess credentials
 * - For production systems with multiple admins, consider using bcrypt/argon2 with a database
 */
export class AdminAuthenticator {
    private usernameBuffer: Buffer;
    private passwordBuffer: Buffer;

    constructor(config: AdminAuthConfig) {
        // Store credentials as buffers for timing-safe comparison
        this.usernameBuffer = Buffer.from(config.username, 'utf-8');
        this.passwordBuffer = Buffer.from(config.password, 'utf-8');
    }

    /**
     * Authenticate username and password using timing-safe comparison
     * @returns true if both username and password match, false otherwise
     */
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

    /**
     * Constant-time buffer comparison using crypto.timingSafeEqual
     * This prevents timing attacks by always taking the same time regardless of where the difference occurs
     */
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
