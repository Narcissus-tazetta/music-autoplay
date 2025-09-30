type Factory = () => unknown;

export class ServiceContainer {
  private factories = new Map<string, Factory>();
  private instances = new Map<string, unknown>();

  register(token: string, factory: Factory) {
    this.factories.set(token, factory);
  }

  get(token: string): unknown {
    let instance = this.instances.get(token);
    if (!instance) {
      const factory = this.factories.get(token);
      if (factory) {
        instance = factory();
        this.instances.set(token, instance);
      } else {
        throw new Error(`Service "${token}" not found in container`);
      }
    }
    return instance;
  }

  getOptional(token: string): unknown {
    let instance = this.instances.get(token);
    if (!instance) {
      const factory = this.factories.get(token);
      if (factory) {
        instance = factory();
        this.instances.set(token, instance);
      }
    }
    return instance;
  }

  has(token: string) {
    return this.factories.has(token) || this.instances.has(token);
  }
}

export const container = new ServiceContainer();

export default container;
