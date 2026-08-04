import { networkInterfaces } from 'node:os';

export interface ActionOriginOptions {
    clientUrl?: string;
    corsOrigins?: string;
    nodeEnv: string;
    port: number;
}

function hostFromOrigin(origin: string): string | null {
    try {
        return new URL(origin).host;
    } catch {
        return null;
    }
}

function addHost(hosts: Set<string>, host: string | null | undefined): void {
    if (!host) return;
    hosts.add(host);
}

function addHostWithPort(hosts: Set<string>, hostname: string, port: number): void {
    const host = hostname.includes(':') && !hostname.startsWith('[')
        ? `[${hostname}]:${port}`
        : `${hostname}:${port}`;
    hosts.add(host);
}

function getLanHosts(port: number): string[] {
    const hosts = new Set<string>();
    try {
        for (const entries of Object.values(networkInterfaces())) {
            for (const entry of entries ?? []) {
                if (entry.internal) continue;
                if (entry.family !== 'IPv4' && entry.family !== 'IPv6') continue;
                addHostWithPort(hosts, entry.address, port);
            }
        }
    } catch {
        return [];
    }
    return [...hosts];
}

export function getAllowedActionOrigins({
    clientUrl,
    corsOrigins,
    nodeEnv,
    port,
}: ActionOriginOptions): string[] {
    const hosts = new Set<string>();

    addHost(hosts, clientUrl ? hostFromOrigin(clientUrl) : null);
    for (const origin of (corsOrigins ?? '').split(',')) {
        const trimmed = origin.trim();
        if (trimmed.length === 0 || trimmed === '*') continue;
        addHost(hosts, hostFromOrigin(trimmed));
    }

    if (nodeEnv !== 'production') {
        addHostWithPort(hosts, 'localhost', port);
        addHostWithPort(hosts, '127.0.0.1', port);
        addHostWithPort(hosts, '0.0.0.0', port);
        addHostWithPort(hosts, '::1', port);
        for (const host of getLanHosts(port)) hosts.add(host);
    }

    return [...hosts].toSorted();
}
