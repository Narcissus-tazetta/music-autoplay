import type { Socket } from "socket.io";
import type { EventMap, EventName } from "../types/socketEvents";

/**
 * registerHandler: ハンドラがソケットごと・イベントごとに一度だけ登録されることを保証するヘルパー。
 */
export function registerHandler<K extends EventName>(
    socket: Socket,
    eventName: K,
    handler: (...args: EventMap[K]) => unknown
): boolean;

export function registerHandler(socket: Socket, eventName: string, handler: (...args: unknown[]) => unknown): boolean;

export function registerHandler(socket: Socket, eventName: string, handler: (...args: unknown[]) => unknown) {
    const metaKey = "__registeredHandlers" as const;
    type SockRecord = Record<string, unknown> & Partial<Pick<Socket, "on">>;
    const sockRec = socket as unknown as SockRecord;

    let meta = sockRec[metaKey] as Set<string> | undefined;
    if (meta && meta.has(eventName)) return false;
    if (!meta) {
        meta = new Set<string>();

        (sockRec as unknown as Record<string, unknown>)[metaKey] = meta;
    }

    const onFn = sockRec.on as ((ev: string, cb: (...args: unknown[]) => void) => void) | undefined;

    if (typeof onFn === "function") {
        onFn.call(socket, eventName, (...args: unknown[]) => {
            try {
                const r = handler(...args);
                if (r && typeof (r as Promise<unknown>).then === "function") {
                    (r as Promise<unknown>).catch((err: unknown) => {
                        void import("./../logger")
                            .then((m) => {
                                try {
                                    const lg = m.default as {
                                        warn: (msg: string, meta?: unknown) => void;
                                    };
                                    lg.warn("socket handler rejected", { eventName, error: err });
                                } catch (e) {
                                    void e;
                                }
                            })
                            .catch((e: unknown) => void e);
                    });
                }
            } catch (err: unknown) {
                void import("./../logger")
                    .then((m) => {
                        try {
                            (m.default as { warn: (msg: string, meta?: unknown) => void }).warn(
                                "socket handler threw",
                                {
                                    eventName,
                                    error: err,
                                }
                            );
                        } catch (e) {
                            void e;
                        }
                    })
                    .catch((e: unknown) => void e);
            }
        });
    } else {
        sockRec[`__on_${String(eventName)}`] = (...args: unknown[]) => {
            try {
                handler(...args);
            } catch (e) {
                void e;
            }
        };
    }
    meta.add(String(eventName));
    return true;
}

export class TimerManager {
    private timers = new Map<string, ReturnType<typeof setTimeout>>();

    start(key: string, ms: number, cb: () => void): ReturnType<typeof setTimeout> {
        this.clear(key);
        const id = setTimeout(() => {
            this.timers.delete(key);
            try {
                cb();
            } catch (e: unknown) {
                void import("./../logger")
                    .then((m) => {
                        try {
                            const lg = m.default as {
                                warn: (msg: string, meta?: unknown) => void;
                            };
                            lg.warn("timer callback threw", { key, error: e });
                        } catch (err) {
                            void err;
                        }
                    })
                    .catch((err: unknown) => void err);
            }
        }, ms);
        this.timers.set(key, id);
        return id;
    }

    clear(key: string) {
        const id = this.timers.get(key);
        if (id !== undefined) {
            clearTimeout(id);
            this.timers.delete(key);
        }
    }

    clearAll() {
        for (const id of this.timers.values()) {
            clearTimeout(id);
        }
        this.timers.clear();
    }
}
