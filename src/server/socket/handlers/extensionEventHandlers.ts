import type { Music, RemoteStatus } from "@/shared/stores/musicStore";
import { isRecord } from "@/shared/utils/typeGuards";
import type { Socket } from "socket.io";
import type { AppLogger } from "../../logger";
import type { MusicEventEmitter } from "../../music/emitter/musicEventEmitter";
import type { MusicRepository } from "../../music/repository/musicRepository";
import type { YouTubeService } from "../../services/youtubeService";
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
  youtubeService: YouTubeService,
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

      if (stateRaw === "transitioning") {
        const transitionStatus = {
          type: "paused",
          musicTitle: undefined,
          musicId: undefined,
          isTransitioning: true,
        } as RemoteStatus;
        try {
          manager.update(transitionStatus, "transitioning");
          log.info("youtube_video_state: transitioning to next video", {
            socketId: socket.id,
            connectionId,
            url,
          });
        } catch (e: unknown) {
          log.warn("failed to update remote status (transitioning)", {
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
        let isExternalVideo = false;
        let externalVideoId: string | undefined = undefined;

        if (url) {
          const { watchUrl, extractYoutubeId } = await import(
            "@/shared/utils/youtube"
          );

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

          if (!match && state === "playing") {
            const videoId = extractYoutubeId(url);
            if (videoId) {
              isExternalVideo = true;
              externalVideoId = videoId;
              try {
                log.debug("Fetching external video details", { videoId, url });
                const result = await youtubeService.getVideoDetails(
                  videoId,
                  1,
                  2000,
                );

                if (result.ok) {
                  match = {
                    url,
                    title: result.value.title,
                  };
                  log.info("External video title fetched", {
                    videoId,
                    title: result.value.title,
                  });
                } else {
                  log.warn("Failed to fetch external video details", {
                    videoId,
                    error: result.error,
                  });
                  match = {
                    url,
                    title: `動画ID: ${videoId}`,
                  };
                }
              } catch (e: unknown) {
                log.warn("Exception while fetching external video details", {
                  videoId,
                  error: e,
                });
                match = {
                  url,
                  title: `動画ID: ${videoId}`,
                };
              }
            }
          }
        }

        const remoteStatus = match
          ? ({
              type: state,
              musicTitle: match.title ?? "",
              musicId: undefined,
              isExternalVideo,
              videoId: externalVideoId,
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
            isExternalVideo,
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

  registerSocketEventSafely(
    extensionSocketOn,
    "move_prev_video",
    async (payload) => {
      if (!isRecord(payload)) {
        log.debug("move_prev_video: invalid payload", { payload });
        return;
      }

      const currentUrl =
        typeof payload["url"] === "string" ? payload["url"] : undefined;

      if (!currentUrl) {
        log.debug("move_prev_video: no url provided", { payload });
        return;
      }

      try {
        const { extractYoutubeId } = await import("@/shared/utils/youtube");
        const currentId = extractYoutubeId(currentUrl);

        if (!currentId) {
          log.debug("move_prev_video: invalid YouTube URL", { currentUrl });
          return;
        }

        const musicList = repository.list();
        const currentIndex = musicList.findIndex((m) => m.id === currentId);

        if (currentIndex === -1) {
          log.debug("move_prev_video: current music not found", { currentId });
          return;
        }

        const prevIndex =
          currentIndex === 0 ? musicList.length - 1 : currentIndex - 1;
        const prevMusic = musicList[prevIndex];

        log.info("move_prev_video: navigating to previous", {
          socketId: socket.id,
          connectionId,
          from: currentId,
          to: prevMusic.id,
          prevIndex,
        });
      } catch (e: unknown) {
        log.warn("move_prev_video: failed to process", {
          socketId: socket.id,
          currentUrl,
          error: e,
        });
      }
    },
    log,
    socketContext,
  );

  registerSocketEventSafely(
    extensionSocketOn,
    "move_next_video",
    async (payload) => {
      if (!isRecord(payload)) {
        log.debug("move_next_video: invalid payload", { payload });
        return;
      }

      const currentUrl =
        typeof payload["url"] === "string" ? payload["url"] : undefined;

      if (!currentUrl) {
        log.debug("move_next_video: no url provided", { payload });
        return;
      }

      try {
        const { extractYoutubeId } = await import("@/shared/utils/youtube");
        const currentId = extractYoutubeId(currentUrl);

        if (!currentId) {
          log.debug("move_next_video: invalid YouTube URL", { currentUrl });
          return;
        }

        const musicList = repository.list();
        const currentIndex = musicList.findIndex((m) => m.id === currentId);

        if (currentIndex === -1) {
          log.debug("move_next_video: current music not found", { currentId });
          return;
        }

        const nextIndex = (currentIndex + 1) % musicList.length;
        const nextMusic = musicList[nextIndex];

        log.info("move_next_video: navigating to next", {
          socketId: socket.id,
          connectionId,
          from: currentId,
          to: nextMusic.id,
          nextIndex,
        });
      } catch (e: unknown) {
        log.warn("move_next_video: failed to process", {
          socketId: socket.id,
          currentUrl,
          error: e,
        });
      }
    },
    log,
    socketContext,
  );

  registerSocketEventSafely(
    extensionSocketOn,
    "tab_closed",
    (payload) => {
      if (!isRecord(payload)) {
        log.debug("tab_closed: invalid payload", { payload });
        return;
      }

      const tabId =
        typeof payload["tabId"] === "number" ? payload["tabId"] : undefined;

      log.info("tab_closed: tab closure detected", {
        socketId: socket.id,
        connectionId,
        tabId,
        timestamp: new Date().toISOString(),
      });

      try {
        log.debug("tab_closed: cleanup completed", {
          socketId: socket.id,
          tabId,
        });
      } catch (e: unknown) {
        log.warn("tab_closed: cleanup failed", {
          socketId: socket.id,
          tabId,
          error: e,
        });
      }
    },
    log,
    socketContext,
  );

  registerSocketEventSafely(
    extensionSocketOn,
    "ad_state_changed",
    async (payload) => {
      if (!isRecord(payload)) {
        log.debug("ad_state_changed: invalid payload", { payload });
        return;
      }

      const url =
        typeof payload["url"] === "string" ? payload["url"] : undefined;
      const isAd =
        typeof payload["isAd"] === "boolean" ? payload["isAd"] : false;
      const timestamp =
        typeof payload["timestamp"] === "number"
          ? payload["timestamp"]
          : Date.now();

      if (!url) {
        log.debug("ad_state_changed: no url provided", { payload });
        return;
      }

      try {
        const { extractYoutubeId } = await import("@/shared/utils/youtube");
        const videoId = extractYoutubeId(url);

        if (!videoId) {
          log.debug("ad_state_changed: invalid YouTube URL", { url });
          return;
        }

        log.info("ad_state_changed: advertisement state changed", {
          socketId: socket.id,
          connectionId,
          videoId,
          isAd,
          timestamp: new Date(timestamp).toISOString(),
        });

        if (isAd) {
          log.debug("ad_state_changed: ad started", { videoId, timestamp });
          const music = repository.get(videoId);
          if (music) {
            const adStatus = {
              type: "playing",
              musicTitle: music.title,
              musicId: videoId,
              isAdvertisement: true,
              adTimestamp: timestamp,
            } as RemoteStatus;
            manager.update(adStatus, "ad_started");
          }
        } else {
          log.debug("ad_state_changed: ad ended, resuming content", {
            videoId,
          });

          const music = repository.get(videoId);
          if (music) {
            const contentStatus = {
              type: "playing",
              musicTitle: music.title,
              musicId: videoId,
              isAdvertisement: false,
              adTimestamp: undefined,
            } as RemoteStatus;
            manager.update(contentStatus, "ad_ended");
          }
        }
      } catch (e: unknown) {
        log.warn("ad_state_changed: failed to process", {
          socketId: socket.id,
          url,
          isAd,
          error: e,
        });
      }
    },
    log,
    socketContext,
  );
}
