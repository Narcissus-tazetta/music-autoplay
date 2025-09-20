import type { RemoteStatus } from "~/stores/musicStore";

export function isRemoteStatusEqual(a: RemoteStatus, b: RemoteStatus): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "playing" && b.type === "playing") {
    return a.musicTitle === b.musicTitle;
  }
  return true;
}

export function shouldDebounce(
  prevUpdatedAt: number,
  now: number,
  debounceMs: number,
): boolean {
  return now - prevUpdatedAt < debounceMs;
}

export default { isRemoteStatusEqual, shouldDebounce };
