import logger from "@/server/logger";
import { err as makeErr } from "@/shared/utils/errors/result-handlers";
import { respondWithResult } from "@/shared/utils/httpResponse";
import type { ActionFunctionArgs } from "react-router";
import { authenticator } from "../../auth/auth.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    return await authenticator.authenticate("google-oidc", request);
  } catch (error: unknown) {
    logger.error("Login action error", { error });
    if (error instanceof Response) return error;
    const message =
      error instanceof Error
        ? error.message
        : typeof error === "string"
          ? error
          : "login failed";
    return respondWithResult(makeErr({ message, code: "unauthorized" }));
  }
};

// クライアント側のコンポーネント（オプション、フォーム送信用）
export default function Login() {
  return null;
}
