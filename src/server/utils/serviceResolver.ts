import { container } from "../di/container";

export class ServiceResolver {
  private static instance: ServiceResolver | undefined;

  private constructor() {}

  static getInstance(): ServiceResolver {
    if (!ServiceResolver.instance)
      ServiceResolver.instance = new ServiceResolver();
    return ServiceResolver.instance;
  }

  // Keep generic so callers can assert a narrower type, even though the type parameter
  // is only used for the return value. ESLint's rule flags this in some configs,
  // so keep the comment to avoid noise.
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  resolve<T = unknown>(token: string): T | undefined {
    return container.getOptional(token) as T | undefined;
  }

  // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters
  resolveRequired<T = unknown>(token: string): T {
    const service = container.getOptional(token);
    if (service === undefined || service === null)
      throw new Error(`Required service not found: ${token}`);
    return service as T;
  }

  has(token: string): boolean {
    return container.getOptional(token) !== undefined;
  }
}

export default ServiceResolver;
