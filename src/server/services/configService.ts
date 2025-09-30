import { SERVER_ENV } from "@/app/env.server";

export class ConfigService {
  getString(
    key: keyof typeof SERVER_ENV,
    fallback?: string,
  ): string | undefined {
    const v = SERVER_ENV[key as string as keyof typeof SERVER_ENV];
    if (typeof v === "string" && v.length > 0) return v;
    return fallback;
  }

  getNumber(
    key: keyof typeof SERVER_ENV,
    fallback?: number,
  ): number | undefined {
    const v = SERVER_ENV[key as string as keyof typeof SERVER_ENV];
    if (typeof v === "number") return v;
    if (typeof v === "string" && v.length > 0) {
      const n = Number(v);
      if (!Number.isNaN(n)) return n;
    }
    return fallback;
  }

  requireString(key: keyof typeof SERVER_ENV): string {
    const v = this.getString(key);
    if (!v) throw new Error(`Missing required config ${key}`);
    return v;
  }

  requireNumber(key: keyof typeof SERVER_ENV): number {
    const v = this.getNumber(key);
    if (typeof v !== "number")
      throw new Error(`Missing or invalid numeric config ${key}`);
    return v;
  }
}

export default ConfigService;
