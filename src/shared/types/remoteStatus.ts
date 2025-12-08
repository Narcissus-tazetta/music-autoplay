import type { RemoteStatus } from '@/shared/stores/musicStore';

export interface RemoteStatusMeta {
    sequenceNumber: number;
    serverTimestamp: number;
    traceId: string;
}

export type RemoteStatusWithMeta = RemoteStatus & {
    _meta?: RemoteStatusMeta;
};
