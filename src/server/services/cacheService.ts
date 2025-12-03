type Entry<V> = { value: V; expiresAt: number };

export class CacheService<V = unknown> {
    private map = new Map<string, Entry<V>>();
    constructor(private maxEntries = 500) {}

    get(key: string): V | undefined {
        const e = this.map.get(key);
        if (!e) return undefined;
        if (Date.now() > e.expiresAt) {
            this.map.delete(key);
            return undefined;
        }
        return e.value;
    }

    set(key: string, value: V, ttlMs = 1000 * 60 * 60 * 24 * 7) {
        if (this.map.size >= this.maxEntries) {
            const first = this.map.keys().next().value;
            if (first) this.map.delete(first);
        }
        this.map.set(key, { value, expiresAt: Date.now() + ttlMs });
    }

    clear() {
        this.map.clear();
    }
}

export default CacheService;
