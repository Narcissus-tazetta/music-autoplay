import logger from "@/server/logger";
import { extractErrorInfo } from "@/shared/utils/errors";

export class ErrorService {
  logWarn(ctx: string, error: unknown, extra?: Record<string, unknown>) {
    const info = extractErrorInfo(error);
    logger.warn(ctx, { error: info, ...extra });
  }

  logError(ctx: string, error: unknown, extra?: Record<string, unknown>) {
    const info = extractErrorInfo(error);
    logger.error(ctx, { error: info, ...extra });
  }

  formatForUser(error: unknown): { message: string; code?: string } {
    const info = extractErrorInfo(error);
    return { message: info.message || "internal error", code: info.code };
  }
}

export default ErrorService;
