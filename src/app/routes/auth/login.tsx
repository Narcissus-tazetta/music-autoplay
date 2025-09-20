import type { ActionFunctionArgs } from "react-router";
import { authenticator } from "../../auth/auth.server";
import logger from "@/server/logger";

export const action = async ({ request }: ActionFunctionArgs) => {
  try {
    // Remix Auth が内部的に CSRF 保護を提供
    return await authenticator.authenticate("google-oidc", request);
  } catch (error) {
    logger.error("Login action error", { error });
    throw error;
  }
};

// クライアント側のコンポーネント（オプション、フォーム送信用）
export default function Login() {
  return null;
}
