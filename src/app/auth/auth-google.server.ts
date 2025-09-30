import logger from "@/server/logger";
import { importJWK, jwtVerify } from "jose";
import { OAuth2Strategy } from "remix-auth-oauth2";

export interface GoogleOIDCClaims {
  sub: string; // ユーザーID（必須）
  email: string; // メールアドレス
  name: string; // 表示名
  picture: string; // プロフィール画像
  iat: number; // 発行時刻
  exp: number; // 有効期限
  aud: string; // オーディエンス（クライアントID）
  iss: string; // 発行者（Google）
  email_verified: boolean; // メール確認済み
}

export class GoogleOIDCStrategy<User> extends OAuth2Strategy<User> {
  name = "google-oidc";

  constructor(
    options: {
      clientId: string;
      clientSecret: string;
      redirectURI: string;
    },
    verify: (profile: GoogleOIDCClaims) => Promise<User> | User,
  ) {
    super(
      {
        clientId: options.clientId,
        clientSecret: options.clientSecret,
        redirectURI: options.redirectURI,
        authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
        tokenEndpoint: "https://oauth2.googleapis.com/token",
        scopes: ["openid", "email", "profile"],
      },
      async ({ tokens }) => {
        const profile = await this.verifyIdToken(
          tokens.idToken(),
          options.clientId,
        );

        return await verify(profile);
      },
    );
  }

  async verifyIdToken(
    idToken: string,
    clientId: string,
  ): Promise<GoogleOIDCClaims> {
    try {
      const jwks = await fetch(
        `https://www.googleapis.com/oauth2/v3/certs`,
      ).then(
        (res) =>
          res.json() as Promise<{ keys: Array<Record<string, unknown>> }>,
      );

      const [header] = idToken.split(".");
      const decodedHeader = JSON.parse(
        Buffer.from(header, "base64").toString("utf-8"),
      ) as Record<string, string>;

      const key = jwks.keys.find((k) => k.kid === decodedHeader.kid);
      if (!key) throw new Error("Public key not found");

      const publicKey = await importJWK(key);
      const { payload } = await jwtVerify<GoogleOIDCClaims>(
        idToken,
        publicKey,
        {
          issuer: "https://accounts.google.com",
          audience: clientId,
        },
      );

      if (!payload.sub || !payload.email)
        throw new Error("Invalid ID token payload");

      return payload;
    } catch (error) {
      logger.error("Failed to verify Google ID token", { error });
      throw new Error("Invalid ID token");
    }
  }
}
