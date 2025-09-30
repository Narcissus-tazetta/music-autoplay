import { createHash } from "crypto";
import logger from "../logger";
import { safeString } from "./errorHandling";

export const withErrorHandler = <T extends unknown[], R>(
  fn: (...args: T) => R,
  context: string,
) => {
  return (...args: T): R | undefined => {
    try {
      return fn(...args);
    } catch (error) {
      logger.error(`Error in ${context}:`, error);
      return undefined;
    }
  };
};

export const withAsyncErrorHandler = <T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  context: string,
) => {
  return async (...args: T): Promise<R | undefined> => {
    try {
      return await fn(...args);
    } catch (error) {
      logger.error(`Error in ${context}:`, error);
      return undefined;
    }
  };
};

export const createAdminHash = (secretCandidate: unknown): string => {
  let secretString: string;

  if (typeof secretCandidate === "string") secretString = secretCandidate;
  else if (typeof secretCandidate === "number")
    secretString = String(secretCandidate);
  else if (typeof secretCandidate === "object" && secretCandidate !== null) {
    try {
      secretString = JSON.stringify(secretCandidate);
    } catch {
      secretString = Object.prototype.toString.call(secretCandidate);
    }
  } else if (typeof secretCandidate === "boolean")
    secretString = secretCandidate ? "true" : "false";
  else if (typeof secretCandidate === "function")
    secretString = secretCandidate.name || String(secretCandidate);
  else secretString = safeString(secretCandidate);

  return createHash("sha256").update(secretString).digest("hex");
};
