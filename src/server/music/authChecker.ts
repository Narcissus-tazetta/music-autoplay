import { SERVER_ENV } from '@/server/env.server';
import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Ownership checks for queue mutations.
 *
 * Admin rights arrive as a capability rather than a flag: the HTTP layer verifies the admin
 * session and then acts as `sha256(ADMIN_SECRET)`, which is the one hash treated as able to
 * touch anyone's entry (see resolveActingRequesterHash). Everyone else acts as their own
 * identity hash and can only touch what they requested.
 */
export class AuthChecker {
    private readonly adminSecretHash: Buffer;

    constructor(adminSecret?: string) {
        this.adminSecretHash = createHash('sha256')
            .update(adminSecret ?? SERVER_ENV.ADMIN_SECRET)
            .digest();
    }

    isAdmin(requesterHash?: string): boolean {
        if (!requesterHash) return false;

        const candidate = Buffer.from(requesterHash, 'hex');
        // A length mismatch is not a secret, and timingSafeEqual rejects unequal lengths.
        if (candidate.length !== this.adminSecretHash.length) return false;

        return timingSafeEqual(candidate, this.adminSecretHash);
    }

    canRemoveMusic(requesterHash?: string, ownerHash?: string): boolean {
        if (ownerHash && requesterHash === ownerHash) return true;
        return this.isAdmin(requesterHash);
    }
}
