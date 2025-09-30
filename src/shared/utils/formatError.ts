export type FormatOptions = {
  maxDepth?: number;
  maxLen?: number;
  joinWith?: string;
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function extractErrorMessage(
  err: unknown,
  opts?: FormatOptions,
): string | undefined {
  const { maxDepth = 3, maxLen = 1000, joinWith = "\n" } = opts ?? {};
  const seen = new WeakSet();
  const userMessages: string[] = [];

  const isUserMessage = (s: string): boolean => {
    const trimmed = s.trim();
    if (trimmed.length === 0) return false;
    if (
      trimmed.startsWith("status:") ||
      trimmed.startsWith("fields:") ||
      trimmed.startsWith("url:")
    )
      return false;
    if (trimmed === "url" || trimmed === "error" || trimmed === "status")
      return false;
    if (trimmed.startsWith("http")) return false;
    return true;
  };

  const pushUserMessage = (s: string | undefined) => {
    if (!s) return;
    const trimmed = s.trim();
    if (isUserMessage(trimmed)) userMessages.push(trimmed);
  };

  function walk(v: unknown, depth: number) {
    if (v === null || v === undefined) return;
    if (userMessages.length >= 10) return;

    if (typeof v === "string") {
      pushUserMessage(v);
      return;
    }
    if (Array.isArray(v)) {
      for (const it of v) {
        if (typeof it === "string") pushUserMessage(it);
        else if (depth < maxDepth) walk(it, depth + 1);
        if (userMessages.length >= 10) break;
      }
      return;
    }
    if (isPlainObject(v)) {
      if (seen.has(v)) return;
      seen.add(v);

      const rec = v;

      if (Array.isArray(rec.formErrors)) {
        for (const fe of rec.formErrors)
          if (typeof fe === "string") pushUserMessage(fe);
      }

      if (typeof rec.message === "string") pushUserMessage(rec.message);
      if (typeof rec.error === "string") pushUserMessage(rec.error);

      if (userMessages.length === 0 && depth < maxDepth) {
        for (const [k, val] of Object.entries(rec)) {
          if (val === undefined || val === null) continue;
          if (k === "status" || k === "url" || k === "fields") continue;

          if (Array.isArray(val)) {
            for (const it of val)
              if (typeof it === "string") pushUserMessage(it);
            continue;
          }
          if (isPlainObject(val)) {
            walk(val, depth + 1);
            continue;
          }
        }
      }
    }
  }

  try {
    walk(err, 0);
  } catch (e) {
    console.debug("formatError fallback parse failed", e);
  }

  if (userMessages.length === 0) return undefined;
  const joined = userMessages.join(joinWith);
  return joined.length > maxLen ? joined.slice(0, maxLen) + "…" : joined;
}
