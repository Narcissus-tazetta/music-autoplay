export function createFakeRepo<T extends { id?: string; url?: string } = { id?: string; url?: string }>(
    list = [] as T[],
) {
    const items: T[] = list.slice();
    return {
        list() {
            return items.slice();
        },
        has(id: string) {
            return items.some(i => (i as any).id === id || (i as any).url === id);
        },
        remove(id: string) {
            const idx = items.findIndex(i => (i as any).id === id || (i as any).url === id);
            if (idx === -1) return { ok: false };
            const [r] = items.splice(idx, 1);
            return { ok: true, removed: r };
        },
        add(item: T) {
            items.push(item);
            return { ok: true };
        },
        peek() {
            return items[0];
        },
        _internal() {
            return items.slice();
        },
        persistRemove(_id: string) {
            return { ok: true };
        },
        buildCompatList() {
            return items.map(m => ({ ...(m as any), url: (m as any).url }));
        },
    } as const;
}

export default createFakeRepo;
