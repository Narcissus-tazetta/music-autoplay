export interface RequestLogEntry {
    id: string;
    requesterHash: string;
    requesterName: string;
    musicId: string;
    title: string;
    url: string;
    requestedAt: string;
}

export interface RequestLogQuery {
    limit?: number;
    requesterHash?: string;
    hashPrefix?: string;
}

export interface MaskedRequestLogEntry {
    id: string;
    requesterHash: string;
    requesterName: string;
    musicId: string;
    title: string;
    url: string;
    requestedAt: string;
}

export interface RequestLogPersistFile {
    entries: RequestLogEntry[];
    lastUpdated?: string;
}

export interface RequestLogStore {
    load(): RequestLogPersistFile;
    query?(input?: RequestLogQuery): RequestLogEntry[] | Promise<RequestLogEntry[]>;
    append(entry: RequestLogEntry): void | Promise<void>;
    pruneExpired?(now: Date): void | Promise<void>;
    replace?(entries: RequestLogEntry[]): void | Promise<void>;
    flush?(): Promise<void>;
    closeSync?(): void;
}
