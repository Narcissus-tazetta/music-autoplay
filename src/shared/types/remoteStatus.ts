import type { RemoteStatus } from '@/shared/types/music';

interface RemoteStatusMeta {
    sequenceNumber: number;
    serverTimestamp: number;
    traceId: string;
}

export type RemoteStatusWithMeta = RemoteStatus & {
    _meta?: RemoteStatusMeta;
};
