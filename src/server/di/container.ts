type Factory = () => unknown;

export class ServiceContainer {
    private factories = new Map<string, Factory>();
    private instances = new Map<string, unknown>();

    register(token: string, factory: Factory) {
        this.factories.set(token, factory);
    }

    // `has` rather than a truthiness check: a factory returning 0/''/false is a legitimate
    // instance, and testing the value re-ran the factory on every lookup.
    get(token: string): unknown {
        if (this.instances.has(token)) return this.instances.get(token);
        const factory = this.factories.get(token);
        if (!factory) throw new Error(`Service "${token}" not found in container`);
        const instance = factory();
        this.instances.set(token, instance);
        return instance;
    }

    getOptional(token: string): unknown {
        if (this.instances.has(token)) return this.instances.get(token);
        const factory = this.factories.get(token);
        if (!factory) return undefined;
        const instance = factory();
        this.instances.set(token, instance);
        return instance;
    }

    has(token: string) {
        return this.factories.has(token) || this.instances.has(token);
    }
}

export const container = new ServiceContainer();

// Register RateLimiterManager as singleton
import { RateLimiterManager } from '../services/rateLimiterManager';
container.register('rateLimiterManager', () => RateLimiterManager.getInstance());

export default container;
