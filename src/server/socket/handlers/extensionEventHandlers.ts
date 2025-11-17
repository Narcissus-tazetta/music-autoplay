import type { Music, RemoteStatus } from "@/shared/stores/musicStore";
import { isRecord } from "@/shared/utils/typeGuards";
import type { Socket } from "socket.io";
import type { AppLogger } from "../../logger";
import type { MusicEventEmitter } from "../../music/emitter/musicEventEmitter";
import type { MusicRepository } from "../../music/repository/musicRepository";
import type { SocketManager } from "../managers/manager";
import { registerSocketEventSafely } from "../utils/eventRegistration";
import { extractSocketOn } from "../utils/socketHelpers";

export function setupExtensionEventHandlers(
  socket: Socket,
  log: AppLogger,
  connectionId: string,
  musicDB: Map<string, Music>,
  manager: SocketManager,
  repository: MusicRepository,
  emitter: MusicEventEmitter,
) {
  const extensionSocketOn = extractSocketOn(socket);
  const socketContext = { socketId: socket.id };

  registerSocketEventSafely(
    extensionSocketOn,
    "extension_heartbeat",
    (data) => {
      log.debug("extension heartbeat received", {
        socketId: socket.id,
        data,
        timestamp: new Date().toISOString(),
      });
    },
    log,
    socketContext,
  );

  registerSocketEventSafely(
    extensionSocketOn,
    "extension_connected",
    (data) => {
      log.info("extension connected event", {
        socketId: socket.id,
        extensionData: data,
        timestamp: new Date().toISOString(),
      });
    },
    log,
    socketContext,
  );

  registerSocketEventSafely(
    extensionSocketOn,
    "tabs_sync",
    (data) => {
      log.debug("extension tabs sync", {
        socketId: socket.id,
        tabCount: Array.isArray(data) ? data.length : 0,
        timestamp: new Date().toISOString(),
      });
    },
    log,
    socketContext,
  );

  registerSocketEventSafely(
    extensionSocketOn,
    "youtube_video_state",
    async (payload) => {
      if (!isRecord(payload)) {
        log.debug("youtube_video_state: ignored invalid payload", { payload });
        return;
      }

      const p = payload;
      const stateRaw = p["state"] as string | undefined;
      const url = typeof p["url"] === "string" ? p["url"] : undefined;

      if (stateRaw === "window_close") {
        const status = { type: "closed" } as RemoteStatus;
        try {
          manager.update(status, "extension");
          log.info(
            "youtube_video_state processed: window_close -> remote closed",
            {
              socketId: socket.id,
              connectionId,
            },
          );
        } catch (e: unknown) {
          log.warn("failed to update remote status (window_close)", {
            error: e,
          });
        }
        return;
      }

      if (stateRaw === "ended") {
        if (url) {
          const { extractYoutubeId } = await import("@/shared/utils/youtube");
          const videoId = extractYoutubeId(url);
          if (videoId && repository.has(videoId)) {
            const removeResult = repository.remove(videoId);
            if (removeResult.ok) {
              const emitResult = emitter.emitMusicRemoved(videoId);
              if (!emitResult.ok) {
                log.warn("youtube_video_state: failed to emit musicRemoved", {
                  error: emitResult.error,
                  videoId,
                });
              }

              const urlListEmitResult = emitter.emitUrlList(
                repository.buildCompatList(),
              );
              if (!urlListEmitResult.ok) {
                log.warn("youtube_video_state: failed to emit url_list", {
                  error: urlListEmitResult.error,
                });
              }

              const persistResult = repository.persistRemove(videoId);
              if (!persistResult.ok) {
                log.warn("youtube_video_state: failed to persist removal", {
                  error: persistResult.error,
                  videoId,
                });
              }
              log.info("youtube_video_state: music removed on ended", {
                socketId: socket.id,
                connectionId,
                videoId,
                url,
              });
            } else {
              log.warn("youtube_video_state: failed to remove music", {
                error: removeResult.error,
                videoId,
              });
            }
          }
        }
        return;
      }

      if (stateRaw === "playing" || stateRaw === "paused") {
        const state = stateRaw === "playing" ? "playing" : "paused";
        let match = null as null | { url: string; title?: string };

        if (url) {
          const { watchUrl } = await import("@/shared/utils/youtube");
          for (const m of musicDB.values()) {
            try {
              const generated = watchUrl((m as { id: string }).id);
              if (generated === url) {
                match = {
                  url: generated,
                  title: (m as { title: string }).title,
                };
                break;
              }
            } catch {
              continue;
            }
          }
        }

        const remoteStatus = match
          ? ({
              type: state,
              musicTitle: match.title ?? "",
              musicId: undefined,
            } as RemoteStatus)
          : state === "playing"
            ? ({
                type: "playing",
                musicTitle: "",
                musicId: undefined,
              } as RemoteStatus)
            : ({
                type: "paused",
                musicTitle: undefined,
                musicId: undefined,
              } as RemoteStatus);

        try {
          manager.update(remoteStatus, "extension");
          log.info("youtube_video_state processed", {
            socketId: socket.id,
            connectionId,
            state: stateRaw,
            url,
            matched: !!match,
          });
        } catch (e: unknown) {
          log.warn("failed to update remote status (playing/paused)", {
            error: e,
          });
        }
        return;
      }

      log.debug("youtube_video_state: unknown state value", {
        state: stateRaw,
        payload,
      });
    },
    log,
    socketContext,
  );

  registerSocketEventSafely(
    extensionSocketOn,
    "delete_url",
    async (url: unknown) => {
      if (typeof url !== "string") {
        log.debug("delete_url: invalid url type", { url, type: typeof url });
        return;
      }

      try {
        const { extractYoutubeId } = await import("@/shared/utils/youtube");
        const videoId = extractYoutubeId(url);

        if (!videoId) {
          log.debug("delete_url: could not extract video ID", { url });
          return;
        }

        if (repository.has(videoId)) {
          const removeResult = repository.remove(videoId);
          if (removeResult.ok) {
            const emitResult = emitter.emitMusicRemoved(videoId);
            if (!emitResult.ok) {
              log.warn("delete_url: failed to emit musicRemoved", {
                error: emitResult.error,
                videoId,
              });
            }

            const urlListEmitResult = emitter.emitUrlList(
              repository.buildCompatList(),
            );
            if (!urlListEmitResult.ok) {
              log.warn("delete_url: failed to emit url_list", {
                error: urlListEmitResult.error,
              });
            }

            const persistResult = repository.persistRemove(videoId);
            if (!persistResult.ok) {
              log.warn("delete_url: failed to persist removal", {
                error: persistResult.error,
                videoId,
              });
            }
            log.info("delete_url: music removed", {
              socketId: socket.id,
              connectionId,
              videoId,
              url,
            });
          } else {
            log.warn("delete_url: failed to remove music", {
              error: removeResult.error,
              videoId,
            });
          }
        } else {
          log.debug("delete_url: video not in database", {
            socketId: socket.id,
            videoId,
            url,
          });
        }
      } catch (e: unknown) {
        log.warn("delete_url: failed to process", {
          socketId: socket.id,
          url,
          error: e,
        });
      }
    },
    log,
    socketContext,
  );
}
