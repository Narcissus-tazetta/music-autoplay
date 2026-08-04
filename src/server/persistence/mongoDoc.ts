/**
 * Document-shape helpers shared by MongoStore, HistoryMongoStore and RequestLogMongoStore.
 *
 * All three map `_id` back onto `id`, stamp `updatedAt` on every write and `createdAt` only
 * on insert, and two of them derive a TTL `expireAt` from a caller-supplied ISO timestamp.
 * Each had its own copy.
 *
 * `dropKeys` stays per-caller on purpose: the three stores expose deliberately different
 * fields (MongoStore hands `updatedAt` through to the socket layer, RequestLogMongoStore
 * strips all bookkeeping), and unifying that would change what callers receive.
 */

/** TTL deadline `ttlMs` past `isoDate`, falling back to now when the date is unparseable. */
export function computeExpireAt(isoDate: string, ttlMs: number): Date {
    const baseMs = Date.parse(isoDate);
    const safeBase = Number.isFinite(baseMs) ? baseMs : Date.now();
    return new Date(safeBase + ttlMs);
}

/**
 * Republishes mongo's `_id` as `id` and drops the bookkeeping fields the caller must not see.
 *
 * The parameter is `object & { _id: string }` rather than `Record<string, unknown>` because
 * the document types are interfaces, which carry no implicit index signature.
 */
export function docToEntity<T>(
    doc: object & { _id: string },
    dropKeys: readonly string[] = [],
): T {
    const { _id, ...rest } = doc as { _id: string } & Record<string, unknown>;
    for (const key of dropKeys) delete rest[key];
    const id = typeof rest.id === 'string' && rest.id.length > 0 ? rest.id : _id;
    return Object.assign(rest, { id }) as T;
}

/**
 * The upsert body every store writes: the entity plus `updatedAt`, with `createdAt` set only
 * when the document is first inserted. `extraSet` carries per-store fields such as `expireAt`.
 */
export function buildUpsert<T extends object>(
    entity: T,
    extraSet: Record<string, unknown> = {},
): { $set: Record<string, unknown>; $setOnInsert: { createdAt: Date } } {
    return {
        $set: { ...entity, updatedAt: new Date(), ...extraSet },
        $setOnInsert: { createdAt: new Date() },
    };
}
