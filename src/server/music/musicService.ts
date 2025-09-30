import { watchUrl } from "@/shared/libs/youtube";
import { createHash, timingSafeEqual } from "crypto";
import type { Music } from "~/stores/musicStore";
import logger, { logMetric } from "../logger";
import { safeString } from "../utils/errorHandling";
import ServiceResolver from "../utils/serviceResolver";
import type { ServiceDependencies } from "../utils/serviceResolver";
import type { EmitOptions } from "../utils/socketEmitter";
import type MusicRepository from "./musicRepository";
import type YouTubeResolver from "./youtubeResolver";

type ReplyOptions = { formErrors?: string[] } | Record<string, unknown>;

export type EmitFn = (
  ev: string,
  payload: unknown,
  options?: EmitOptions,
) => boolean | undefined;

export default class MusicService {
  constructor(
    private repo: MusicRepository,
    private resolver: YouTubeResolver,
    private emitFn: EmitFn,
  ) {}

  buildCompatList(): (Music & { url: string })[] {
    return this.repo.buildCompatList();
  }

  async addMusic(url: string, requesterHash?: string): Promise<ReplyOptions> {
    const res = (await this.resolver.resolve(url)) as {
      ok: boolean;
      error?: unknown;
      value?: unknown;
    };
    if (!res.ok) {
      const err: unknown = res.error;
      return {
        formErrors: [
          typeof err === "string" ? err : safeString(err) || "video not found",
        ],
      };
    }
    const meta: unknown = res.value;
    const id =
      meta &&
      typeof meta === "object" &&
      typeof (meta as Record<string, unknown>).id === "string"
        ? String((meta as Record<string, unknown>).id)
        : "";
    if (!id) return { formErrors: ["video not found"] };
    if (this.repo.has(id)) return { formErrors: ["already added"] };

    const typedMeta =
      meta && typeof meta === "object" ? (meta as Record<string, unknown>) : {};
    const title = typeof typedMeta.title === "string" ? typedMeta.title : id;
    const channelTitle =
      typeof typedMeta.channelTitle === "string" ? typedMeta.channelTitle : "";
    const channelId =
      typeof typedMeta.channelId === "string" ? typedMeta.channelId : "";
    const duration =
      typeof typedMeta.duration === "string" ? typedMeta.duration : "PT0S";

    const music: Music = {
      title,
      channelName: channelTitle,
      id,
      channelId,
      duration,
      requesterHash,
    };

    this.repo.add(music);
    logger.info("music added", { id, title: music.title, requesterHash });

    this.emitFn("musicAdded", music, {
      context: { operation: "addMusic", identifiers: { musicId: id } },
    });
    this.emitFn(
      "addMusic",
      { ...music, url: watchUrl(music.id) },
      {
        context: { operation: "addMusic-legacy", identifiers: { musicId: id } },
      },
    );
    this.emitFn("url_list", this.buildCompatList(), {
      context: { operation: "addMusic-urlList", identifiers: { musicId: id } },
    });

    await this.repo.persistAdd(music);
    try {
      logMetric(
        "musicAdded",
        { source: "service" },
        { id, title: music.title },
      );
    } catch (e: unknown) {
      logger.debug("logMetric failed", { error: e, id });
    }

    return {};
  }

  removeMusic(url: string, requesterHash?: string): ReplyOptions {
    const id = url.split("v=").pop() || url;
    if (!this.repo.has(id)) return { formErrors: ["not found"] };
    const existing = this.repo.get(id);
    if (!existing) return { formErrors: ["not found"] };
    const serviceResolver = ServiceResolver.getInstance();
    const dependencies = serviceResolver.resolveDependencies(
      {},
    ) as ServiceDependencies;
    let adminSecret = "";
    if (
      dependencies.configService &&
      typeof dependencies.configService.getString === "function"
    )
      adminSecret = dependencies.configService.getString("ADMIN_SECRET") ?? "";
    let adminSecretHash: Buffer | undefined;
    try {
      if (typeof adminSecret === "string" && adminSecret.trim().length > 0)
        adminSecretHash = createHash("sha256").update(adminSecret).digest();
    } catch {
      adminSecretHash = undefined;
    }
    let isAdminBySecret = false;
    try {
      if (typeof requesterHash === "string") {
        let reqHashBuf: Buffer;
        try {
          reqHashBuf = Buffer.from(requesterHash, "hex");
        } catch {
          reqHashBuf = Buffer.from(requesterHash);
        }
        if (adminSecretHash?.length === reqHashBuf.length)
          isAdminBySecret = timingSafeEqual(reqHashBuf, adminSecretHash);
      }
    } catch {
      isAdminBySecret = false;
    }
    if (!existing.requesterHash && !isAdminBySecret)
      return { formErrors: ["forbidden"] };
    const isOriginalRequester = existing.requesterHash === requesterHash;
    if (!isOriginalRequester && !isAdminBySecret)
      return { formErrors: ["forbidden"] };

    this.repo.remove(id);
    logger.info("music removed", {
      id,
      requesterHash,
      isAdmin: isAdminBySecret,
    });

    this.emitFn("musicRemoved", id, {
      context: { operation: "removeMusic", identifiers: { musicId: id } },
    });
    this.emitFn("deleteMusic", watchUrl(id), {
      context: {
        operation: "removeMusic-legacy",
        identifiers: { musicId: id },
      },
    });
    this.emitFn("url_list", this.buildCompatList(), {
      context: {
        operation: "removeMusic-urlList",
        identifiers: { musicId: id },
      },
    });

    this.repo.persistRemove(id);
    try {
      logMetric("musicRemoved", { source: "service" }, { id });
    } catch (err: unknown) {
      logger.debug("logMetric(musicRemoved) failed", { error: err, id });
    }

    return {};
  }
}
