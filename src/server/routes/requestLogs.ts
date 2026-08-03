import express, { Router } from 'express';
import { requirePathfinder } from '../middleware/requireRole';
import { getRequestLogService } from '../requestLog/requestLogService';

const LIMIT_DEFAULT = 50;
const LIMIT_MAX = 500;
const REQUESTER_HASH_PATTERN = /^[a-f0-9]{64}$/i;
const REQUESTER_HASH_PREFIX_PATTERN = /^[a-f0-9]{4,64}$/i;

interface HashFilter {
    hashPrefix?: string;
    requesterHash?: string;
}

function clampLimit(raw: unknown): number {
    const value = typeof raw === 'number' ? raw : (typeof raw === 'string' ? Number.parseInt(raw, 10) : NaN);
    if (!Number.isFinite(value)) return LIMIT_DEFAULT;
    return Math.min(Math.max(value, 1), LIMIT_MAX);
}

function parseHashFilter(rawHash: unknown, rawPrefix: unknown): HashFilter {
    const hash = typeof rawHash === 'string' ? rawHash.trim() : '';
    if (REQUESTER_HASH_PATTERN.test(hash) || hash === 'external') return { requesterHash: hash };

    const hashPrefix = typeof rawPrefix === 'string' ? rawPrefix.trim() : '';
    if (REQUESTER_HASH_PREFIX_PATTERN.test(hashPrefix)) return { hashPrefix };

    return {};
}

async function query(filter: HashFilter, limit: unknown) {
    return getRequestLogService().query({ ...filter, limit: clampLimit(limit) });
}

/**
 * Three routes that all resolve to the same "filter by requester hash, clamp the limit,
 * return entries" operation; they previously repeated that body verbatim.
 */
export const requestLogsRouter: Router = Router();

requestLogsRouter.use(requirePathfinder, (_req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
});

requestLogsRouter.post('/query', express.json({ limit: '8kb' }), async (req, res) => {
    const body = (req.body && typeof req.body === 'object' && !Array.isArray(req.body)
        ? req.body
        : {}) as Record<string, unknown>;

    const filter = parseHashFilter(body.requesterHash, body.hashPrefix);
    if (!filter.requesterHash && !filter.hashPrefix) {
        res.status(400).json({ error: 'invalid_requester_hash', ok: false });
        return;
    }

    res.json({ entries: await query(filter, body.limit), ok: true });
});

requestLogsRouter.get('/', async (req, res) => {
    const filter = parseHashFilter(req.query.hash, req.query.hashPrefix);
    res.json({ entries: await query(filter, req.query.limit), ok: true });
});

requestLogsRouter.get('/:hashPrefix', async (req, res) => {
    const hashPrefix = req.params.hashPrefix;
    const filter = parseHashFilter(req.query.hash, hashPrefix);
    if (!filter.requesterHash && !filter.hashPrefix) {
        res.status(400).json({ error: 'invalid_hash_prefix', ok: false });
        return;
    }

    res.json({ entries: await query(filter, req.query.limit), hashPrefix, ok: true });
});
