export type MessageKey =
  | "SUCCESS_ADDED"
  | "ERROR_ALREADY_EXISTS"
  | "ERROR_NOT_FOUND"
  | "ERROR_FORBIDDEN"
  | "ERROR_ADD_FAILED";

const MESSAGES = {
  SUCCESS_ADDED: "楽曲を追加しました",
  ERROR_ALREADY_EXISTS: (position: number) =>
    `この楽曲はすでに${position}番目に登録されています`,
  ERROR_NOT_FOUND: "この楽曲は登録されていません",
  ERROR_FORBIDDEN: "この楽曲を削除する権限がありません",
  ERROR_ADD_FAILED: "楽曲の追加に失敗しました。後ほど再度お試しください。",
} as const;

export function getMessage(key: MessageKey, ...args: unknown[]): string {
  const v = (MESSAGES as unknown as Record<string, unknown>)[key];
  if (typeof v === "function")
    return (v as (...a: unknown[]) => string)(...args);
  return v as string;
}

export default MESSAGES;
