import type { Server as IOServer } from "socket.io";
import type { Music } from "~/stores/musicStore";
import type { MusicService } from "../../music/musicService";
import { createMusicService } from "../../music/musicServiceFactory";
import type { Store } from "../../persistence";
import { type WindowCloseManager } from "../../services/windowCloseManager";
import { type YouTubeService } from "../../services/youtubeService";
import { createSocketEmitter } from "../../utils/safeEmit";
import type { TimerManager } from "../../utils/timerManager";
import { SocketManager } from "./manager";

export type RuntimeOptions = {
  debounceMs: number;
  graceMs: number;
  inactivityMs: number;
};

export class SocketRuntime {
  private manager?: SocketManager;
  private musicService?: MusicService;
  private safeEmit: (event: string, payload: unknown) => boolean;

  constructor(
    private readonly ioGetter: () => IOServer,
    private readonly musicDB: Map<string, Music>,
    private readonly youtubeService: YouTubeService,
    private readonly fileStore: Store,
    private readonly timerManager: TimerManager,
    private readonly windowCloseManager: InstanceType<
      typeof WindowCloseManager
    >,
    private readonly opts: RuntimeOptions,
  ) {
    const emitter = createSocketEmitter(this.ioGetter, {
      source: "SocketRuntime",
    });
    this.safeEmit = (event: string, payload: unknown) =>
      emitter.emit(event, payload);
  }

  getManager(): SocketManager | undefined {
    return this.manager;
  }

  createManager(): SocketManager {
    if (!this.manager) {
      // Create a safe emit function for the manager
      const managerEmitter = createSocketEmitter(this.ioGetter, {
        source: "SocketManager",
      });

      this.manager = new SocketManager(
        managerEmitter.asFn(),
        this.timerManager,
        this.windowCloseManager,
        {
          debounceMs: this.opts.debounceMs,
          graceMs: this.opts.graceMs,
          inactivityMs: this.opts.inactivityMs,
        },
      );
    }
    return this.manager;
  }

  getMusicService(): MusicService {
    if (!this.musicService) {
      const musicEmitter = createSocketEmitter(this.ioGetter, {
        source: "MusicService",
      });
      this.musicService = createMusicService({
        youtubeService: this.youtubeService,
        musicDB: this.musicDB,
        fileStore: this.fileStore,
        emitFn: (ev, payload, opts?) => musicEmitter.emit(ev, payload, opts),
      });
    }
    return this.musicService;
  }

  emit(event: string, ...args: unknown[]): void {
    this.safeEmit(event, args[0]);
  }
}
