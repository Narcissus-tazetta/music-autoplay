import { hasOwnProperty, isRecord } from "@/shared/utils/typeGuards";

type ExtractResult = {
  consumedKey?: string;
  extractedState?: string | undefined;
  extractedUrl?: string | undefined;
  rest: Record<string, unknown>;
};

function extractStringField(
  obj: Record<string, unknown>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string") return value;
  }
  return undefined;
}

export function extractMetaFields(
  metaObjRaw: Record<string, unknown>,
  metaForPrint: Record<string, unknown>,
): ExtractResult {
  let extractedState: string | undefined;
  let extractedUrl: string | undefined;
  let consumedKey: string | undefined;

  if (hasOwnProperty(metaObjRaw, "youtube") && isRecord(metaForPrint.youtube)) {
    const y = metaForPrint.youtube;
    extractedUrl = extractStringField(y, "url");
    extractedState = extractStringField(y, "state");
    consumedKey = "youtube";
  }

  if (
    !extractedState &&
    hasOwnProperty(metaObjRaw, "status") &&
    isRecord(metaForPrint.status)
  ) {
    const s = metaForPrint.status;
    extractedState = extractStringField(s, "type", "state");
    if (!extractedUrl)
      extractedUrl = extractStringField(s, "musicId", "musicTitle");
    consumedKey = consumedKey || "status";
  }

  if (!extractedState && hasOwnProperty(metaObjRaw, "args")) {
    const args = metaForPrint.args;
    if (Array.isArray(args) && args.length > 0 && isRecord(args[0])) {
      const a0 = args[0];
      extractedState = extractStringField(a0, "state", "type");
      extractedUrl = extractedUrl || extractStringField(a0, "url");
      consumedKey = consumedKey || "args";
    }
  }

  const rest: Record<string, unknown> = {};
  for (const key of Object.keys(metaForPrint))
    if (key !== consumedKey) rest[key] = metaForPrint[key];

  return { consumedKey, extractedState, extractedUrl, rest };
}

export function normalizeMetaForPrint(
  metaObj: unknown,
): Record<string, unknown> {
  if (isRecord(metaObj)) return metaObj;
  return { value: metaObj };
}
