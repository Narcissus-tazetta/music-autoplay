import type { Music, RemoteStatus } from '@/shared/stores/musicStore';
import type { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import logger, { withContext } from '../logger';
import type { SocketServerInstance } from '../socket';
import { setupExtensionEventHandlers } from '../socket/handlers/extensionEventHandlers';

type BrokerSnapshot = {
    urlList: Array<Music & { url: string }>;
    remoteStatus: RemoteStatus & { _meta?: { sequenceNumber: number; serverTimestamp: number; traceId: string } };
};

type VirtualHandler = (...args: unknown[]) => void;

class VirtualSocket {
    id: string;
    private handlers = new Map<string, Set<VirtualHandler>>();

    constructor(private publish: (event: string, payload: unknown) => void) {
        this.id = `broker:${randomUUID()}`;
    }

    on(event: string, handler: VirtualHandler): void {
        const set = this.handlers.get(event) ?? new Set<VirtualHandler>();
        set.add(handler);
        this.handlers.set(event, set);
    }

    emit(event: string, payload: unknown): boolean {
        this.publish(event, payload);
        return true;
    }

    trigger(event: string, payload?: unknown, callback?: (response: unknown) => void): void {
        const handlers = this.handlers.get(event);
        if (!handlers || handlers.size === 0) return;
        const args: unknown[] = [];
        if (typeof payload !== 'undefined') args.push(payload);
        if (typeof callback === 'function') args.push(callback);
        for (const handler of handlers) {
            try {
                handler(...args);
            } catch {
                // ignore
            }
        }
    }
}

type SseClient = {
    id: string;
    res: Response;
    heartbeatId: NodeJS.Timeout;
};

export class ExtensionBroker {
    private clients = new Set<SseClient>();
    private virtualSocket: VirtualSocket;
    private connectionId: string;

    constructor(private socketServer: SocketServerInstance) {
        this.connectionId = `broker-conn:${randomUUID()}`;
        this.virtualSocket = new VirtualSocket((event, payload) => this.publish(event, payload));

        const manager = socketServer.getOrCreateManagerForBroker();
        const musicService = socketServer.getMusicServiceForBroker();
        if (manager) {
            const log = withContext({ connectionId: this.connectionId, socketId: this.virtualSocket.id });
            setupExtensionEventHandlers(
                this.virtualSocket as never,
                log,
                this.connectionId,
                socketServer.musicDB,
                manager,
                musicService.repository,
                musicService.emitter,
                socketServer.youtubeService,
            );
        } else {
            logger.warn('ExtensionBroker: manager unavailable, event handlers not initialized');
        }
    }

    attachToIo(io: unknown): void {
        if (!io || typeof (io as { emit?: unknown }).emit !== 'function') return;
        const anyIo = io as { emit: (...args: unknown[]) => unknown; __brokerWrapped?: boolean };
        if (anyIo.__brokerWrapped) return;
        const originalEmit = anyIo.emit.bind(io);
        anyIo.emit = (...args: unknown[]) => {
            const event = args[0];
            const payload = args[1];
            if (typeof event === 'string') this.publish(event, payload);
            return originalEmit(...args);
        };
        anyIo.__brokerWrapped = true;
    }

    getSnapshot(): BrokerSnapshot {
        const musicService = this.socketServer.getMusicServiceForBroker();
        const urlList = musicService.repository.buildCompatList();
        const manager = this.socketServer.getOrCreateManagerForBroker();
        const remoteStatus = manager
            ? manager.getSnapshot()
            : ({ type: 'closed' } as RemoteStatus & {
                _meta?: { sequenceNumber: number; serverTimestamp: number; traceId: string };
            });
        return { urlList, remoteStatus };
    }

    handleSse(req: Request, res: Response): void {
        const clientId = `broker-client:${randomUUID()}`;
        const origin = typeof req.headers.origin === 'string' ? req.headers.origin : '*';

        res.status(200);
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('X-Accel-Buffering', 'no');
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');

        const heartbeatId = setInterval(() => {
            try {
                res.write(': ping\n\n');
            } catch {
                // ignore
            }
        }, 25000);

        const client: SseClient = { id: clientId, res, heartbeatId };
        this.clients.add(client);

        try {
            const snapshot = this.getSnapshot();
            this.sendEvent(res, 'broker_ready', { clientId, ts: Date.now() });
            this.sendEvent(res, 'url_list', snapshot.urlList);
            this.sendEvent(res, 'remote_status', snapshot.remoteStatus);
        } catch (error) {
            logger.debug('ExtensionBroker: failed to send initial snapshot', { error });
        }

        const cleanup = () => {
            clearInterval(heartbeatId);
            this.clients.delete(client);
            try {
                res.end();
            } catch {
                // ignore
            }
        };

        req.on('close', cleanup);
        res.on('close', cleanup);
    }

    async handleEvent(
        event: string,
        payload: unknown,
        expectAck: boolean,
    ): Promise<unknown> {
        if (!event) return { status: 'error', error: 'event is required' };
        if (event === 'request_url_list') {
            try {
                const snapshot = this.getSnapshot();
                this.publish('url_list', snapshot.urlList);
                return { status: 'ok', response: { ok: true } };
            } catch (error) {
                return { status: 'error', error: error instanceof Error ? error.message : String(error) };
            }
        }
        if (!expectAck) {
            this.virtualSocket.trigger(event, payload);
            return { status: 'ok' };
        }

        return await new Promise(resolve => {
            const timeoutId = setTimeout(() => {
                resolve({ status: 'error', error: 'ack timeout' });
            }, 4000);

            try {
                this.virtualSocket.trigger(event, payload, response => {
                    clearTimeout(timeoutId);
                    resolve({ status: 'ok', response });
                });
            } catch (error) {
                clearTimeout(timeoutId);
                resolve({ status: 'error', error: error instanceof Error ? error.message : String(error) });
            }
        });
    }

    publish(event: string, payload: unknown): void {
        for (const client of this.clients) this.sendEvent(client.res, event, payload);
    }

    private sendEvent(res: Response, event: string, payload: unknown): void {
        try {
            const data = JSON.stringify(payload ?? null);
            res.write(`event: ${event}\n`);
            res.write(`data: ${data}\n\n`);
        } catch (error) {
            logger.debug('ExtensionBroker: failed to send SSE event', { error });
        }
    }
}

export function createExtensionBroker(socketServer: SocketServerInstance): ExtensionBroker {
    return new ExtensionBroker(socketServer);
}
