import { randomBytes } from "crypto";

export function generateState() {
  return randomBytes(16).toString("hex");
}

export function verifyState(sessionState: string, receivedState: string) {
  return sessionState === receivedState;
}

/**
 * OAuth セッションの有効性を検証
 */
export function validateOAuthSession(
  receivedState: string | null,
  sessionState: string | undefined,
  timestamp: number | undefined,
): { isValid: boolean; reason?: string } {
  if (!receivedState)
    return { isValid: false, reason: "state parameter missing" };

  if (!sessionState) return { isValid: false, reason: "session state missing" };

  if (receivedState !== sessionState)
    return { isValid: false, reason: "state mismatch" };

  if (!timestamp) return { isValid: false, reason: "timestamp missing" };

  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  if (timestamp < oneHourAgo)
    return { isValid: false, reason: "session expired" };

  return { isValid: true };
}
