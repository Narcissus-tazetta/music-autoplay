import logger from "@/server/logger";

export function handleAsyncError(
  operation: string,
  context?: Record<string, unknown>,
) {
  return (error: unknown) => {
    logger.warn(`${operation} failed`, { error, ...context });
  };
}

export function wrapAsync<T extends Array<unknown>, R>(
  fn: (...args: T) => R | Promise<R>,
  operation?: string,
) {
  return (...args: T): Promise<R | undefined> => {
    try {
      return Promise.resolve(fn(...args)).catch((e: unknown) => {
        if (operation) logger.warn(`${operation} failed`, { error: e });
        else logger.warn("unhandled async error", { error: e });
        return undefined;
      });
    } catch (e: unknown) {
      if (operation) logger.warn(`${operation} failed`, { error: e });
      else logger.warn("unhandled async error", { error: e });
      return Promise.resolve(undefined);
    }
  };
}

export default { handleAsyncError, wrapAsync };
