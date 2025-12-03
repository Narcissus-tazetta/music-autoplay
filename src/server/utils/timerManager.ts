import { safeLog } from '@/server/logger';

export class TimerManager {
    private timers = new Map<string, ReturnType<typeof setTimeout>>();

    start(
        key: string,
        ms: number,
        cb: () => void,
    ): ReturnType<typeof setTimeout> {
        this.clear(key);
        const id = setTimeout(() => {
            this.timers.delete(key);
            try {
                cb();
            } catch (e: unknown) {
                safeLog('warn', 'timer callback threw', { key, error: e } as Record<
                    string,
                    unknown
                >);
            }
        }, ms);
        this.timers.set(key, id);
        return id;
    }

    clear(key: string): void {
        const id = this.timers.get(key);
        if (id !== undefined) {
            clearTimeout(id);
            this.timers.delete(key);
        }
    }

    clearAll(): void {
        for (const id of this.timers.values()) clearTimeout(id);
        this.timers.clear();
    }
}
