import { SERVER_ENV } from '@/app/env.server';
import type ConfigService from '../config/configService';
import ServiceResolver from './serviceResolver';

export function getConfig(): {
    nodeEnv: string;
    getString: (key: keyof typeof SERVER_ENV) => string;
    getNumber: (key: keyof typeof SERVER_ENV) => number | undefined;
} {
    const serviceResolver = ServiceResolver.getInstance();
    const cfg = serviceResolver.resolve<ConfigService>('configService');

    return {
        getNumber: key => {
            const value = cfg?.getNumber(key);
            if (typeof value === 'number') return value;
            return typeof SERVER_ENV[key] === 'number' ? SERVER_ENV[key] : undefined;
        },
        getString: key => {
            const value = cfg?.getString(key) ?? SERVER_ENV[key];
            return typeof value === 'string' ? value : String(value ?? '');
        },
        nodeEnv: cfg?.getString('NODE_ENV') ?? SERVER_ENV.NODE_ENV,
    };
}

export function safeNumber(v: unknown, fallback: number): number {
    if (typeof v === 'number' && !Number.isNaN(v)) return v;
    if (typeof v === 'string') {
        const n = Number(v);
        if (!Number.isNaN(n)) return n;
    }
    return fallback;
}
