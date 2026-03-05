import { container } from '../di/container';

export class ServiceResolver {
    private static instance: ServiceResolver | undefined;

    private constructor() {}

    static getInstance(): ServiceResolver {
        if (!ServiceResolver.instance) ServiceResolver.instance = new ServiceResolver();
        return ServiceResolver.instance;
    }

    resolve<T = unknown>(token: string): T | undefined {
        return container.getOptional(token) as T | undefined;
    }
    resolveRequired<T = unknown>(token: string): T {
        const service = container.getOptional(token);
        if (service == undefined) throw new Error(`Required service not found: ${token}`);
        return service as T;
    }

    has(token: string): boolean {
        return container.getOptional(token) !== undefined;
    }
}

export default ServiceResolver;
