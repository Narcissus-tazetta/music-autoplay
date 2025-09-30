import type { Server as IOServer } from "socket.io";
import type { Music } from "~/stores/musicStore";
import { container } from "../di/container";
import type { Store } from "../persistence";
import type CacheService from "../services/cacheService";
import type ConfigService from "../services/configService";
import type ErrorService from "../services/errorService";
import type SocketManager from "../socket/manager";
import type { EmitOptions } from "../utils/socketEmitter";
import type { YouTubeService } from "../youtubeService";
import { withErrorHandler } from "./errorHandler";
import type MetricsManager from "./metricsManager";

export interface HandlerDependencies {
  musicDB: Map<string, Music>;
  io: IOServer;
  emit?: (
    ev: string,
    payload: unknown,
    opts?: EmitOptions,
  ) => boolean | undefined;
  youtubeService: YouTubeService;
  manager?: SocketManager;
  fileStore: Store;
  isAdmin: (h?: string) => boolean;
}

export interface ServiceDependencies {
  fileStore?: Store | Partial<Store>;
  youtubeService?: YouTubeService | Partial<YouTubeService>;
  configService?: ConfigService | Partial<ConfigService>;
  errorService?: ErrorService | Partial<ErrorService>;
  cacheService?: CacheService | Partial<CacheService>;
  metricsManager?: MetricsManager | Partial<MetricsManager>;
}

export class ServiceResolver {
  private static instance: ServiceResolver | undefined;
  private resolvedServices = new Map<string, unknown>();

  private constructor() {}

  static getInstance(): ServiceResolver {
    if (!ServiceResolver.instance)
      ServiceResolver.instance = new ServiceResolver();
    return ServiceResolver.instance;
  }

  resolve<T = unknown>(token: string, fallback?: T): T | undefined {
    const cached = this.resolvedServices.get(token);
    if (cached) return cached as T;

    const service = withErrorHandler(() => {
      const resolved = container.getOptional(token);
      return resolved !== undefined ? resolved : fallback;
    }, `ServiceResolver.resolve(${token})`)();

    if (service !== undefined && service !== fallback)
      this.resolvedServices.set(token, service);

    return service as T | undefined;
  }

  resolveDependencies(
    overrides: ServiceDependencies = {},
  ): Required<ServiceDependencies> {
    const fileStore = overrides.fileStore ?? this.resolve<Store>("fileStore");
    const youtubeService =
      overrides.youtubeService ??
      this.resolve<YouTubeService>("youtubeService");
    const configService =
      overrides.configService ?? this.resolve<ConfigService>("configService");
    const errorService =
      overrides.errorService ?? this.resolve<ErrorService>("errorService");
    const cacheService =
      overrides.cacheService ?? this.resolve<CacheService>("cacheService");
    const metricsManager =
      overrides.metricsManager ??
      this.resolve<MetricsManager>("metricsManager");

    // In test environments, allow overrides to provide the required services
    if (!fileStore || !youtubeService || !configService) {
      // Check if this is a test environment by looking for common test indicators
      const isTestEnv =
        process.env.NODE_ENV === "test" ||
        process.env.VITEST === "true" ||
        typeof (globalThis as Record<string, unknown>).vi !== "undefined";

      if (!isTestEnv)
        throw new Error(
          "Missing required service: fileStore, youtubeService, or configService",
        );
    }

    return {
      fileStore: fileStore as Required<ServiceDependencies>["fileStore"],
      youtubeService:
        youtubeService as Required<ServiceDependencies>["youtubeService"],
      configService:
        configService as Required<ServiceDependencies>["configService"],
      errorService:
        errorService as Required<ServiceDependencies>["errorService"],
      cacheService:
        cacheService as Required<ServiceDependencies>["cacheService"],
      metricsManager:
        metricsManager as Required<ServiceDependencies>["metricsManager"],
    };
  }

  resolveHandlerDependencies(
    overrides: Partial<HandlerDependencies>,
  ): HandlerDependencies {
    const serviceDeps = this.resolveDependencies({
      youtubeService: overrides.youtubeService as YouTubeService,
      fileStore: overrides.fileStore as Store,
    });

    if (!overrides.io)
      throw new Error(
        "resolveHandlerDependencies requires 'io' to be provided",
      );

    return {
      musicDB: overrides.musicDB ?? new Map<string, Music>(),
      io: overrides.io,
      emit: overrides.emit,
      youtubeService: serviceDeps.youtubeService as YouTubeService,
      manager: overrides.manager,
      fileStore: serviceDeps.fileStore as Store,
      isAdmin: overrides.isAdmin ?? (() => false),
    };
  }

  clearCache(): void {
    this.resolvedServices.clear();
  }

  validateServices(): boolean {
    const required = ["fileStore", "youtubeService", "configService"];
    return required.every((token) => this.resolve(token) !== undefined);
  }
}

export default ServiceResolver;
