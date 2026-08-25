import { safeString } from '@/shared/utils/errors';
import { createHash } from 'node:crypto';

/**
 * sha256 of the admin secret, hex encoded. This is the requesterHash AuthChecker treats as
 * all-powerful, so both the socket layer and the HTTP music actions derive it through here.
 *
 * Lives under `src/server/` rather than `shared/utils/errors/` because it is the only piece of
 * that module needing `node:crypto`: keeping it there let the barrel pull a Node builtin into
 * the client graph as soon as any browser code imported from `@/shared/utils/errors`.
 */
export function createAdminHash(secretCandidate: unknown): string {
    const secretString = safeString(secretCandidate);
    return createHash('sha256').update(secretString).digest('hex');
}
