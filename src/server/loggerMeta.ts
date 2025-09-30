type ExtractResult = {
  consumedKey?: string;
  extractedState?: string | undefined;
  extractedUrl?: string | undefined;
  rest: Record<string, unknown>;
};

export function extractMetaFields(
  metaObjRaw: Record<string, unknown>,
  metaForPrint: Record<string, unknown>,
): ExtractResult {
  let extractedState: string | undefined;
  let extractedUrl: string | undefined;
  let consumedKey: string | undefined;

  if (
    Object.prototype.hasOwnProperty.call(metaObjRaw, "youtube") &&
    isRecord(metaForPrint.youtube)
  ) {
    const y = metaForPrint.youtube;
    extractedUrl = typeof y.url === "string" ? y.url : undefined;
    extractedState = typeof y.state === "string" ? y.state : undefined;
    consumedKey = "youtube";
  }

  if (
    !extractedState &&
    Object.prototype.hasOwnProperty.call(metaObjRaw, "status") &&
    isRecord(metaForPrint.status)
  ) {
    const s = metaForPrint.status;
    extractedState =
      typeof s.type === "string"
        ? s.type
        : typeof s.state === "string"
          ? s.state
          : undefined;
    if (!extractedUrl) {
      extractedUrl =
        typeof s.musicId === "string"
          ? s.musicId
          : typeof s.musicTitle === "string"
            ? s.musicTitle
            : undefined;
    }
    consumedKey = consumedKey || "status";
  }

  if (
    !extractedState &&
    Object.prototype.hasOwnProperty.call(metaObjRaw, "args")
  ) {
    const args = metaForPrint.args;
    if (Array.isArray(args) && args.length > 0 && isRecord(args[0])) {
      const a0 = args[0];
      extractedState =
        typeof a0.state === "string"
          ? a0.state
          : typeof a0.type === "string"
            ? a0.type
            : undefined;
      extractedUrl =
        extractedUrl || (typeof a0.url === "string" ? a0.url : undefined);
      consumedKey = consumedKey || "args";
    }
  }

  const rest: Record<string, unknown> = {};
  for (const key of Object.keys(metaForPrint))
    if (key !== consumedKey) rest[key] = metaForPrint[key];

  return { consumedKey, extractedState, extractedUrl, rest };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

export function normalizeMetaForPrint(
  metaObj: unknown,
): Record<string, unknown> {
  if (isRecord(metaObj)) return metaObj;
  return { value: metaObj };
}
