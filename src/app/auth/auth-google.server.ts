import logger from '@/server/logger.server';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { OAuth2Strategy } from 'remix-auth-oauth2';

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

/**
 * Google's signing keys, fetched once and refreshed on rotation.
 *
 * This replaces fetching the JWKS and hand-decoding the JWT header on every single login:
 * that added an uncached, untimed round trip to each sign-in, and decoded the header as
 * base64 rather than base64url, so a `-`/`_` in it silently corrupted the key lookup.
 */
const googleJwks = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'), {
    cooldownDuration: 30_000,
    timeoutDuration: 5_000,
});

export class GoogleOIDCStrategy<User> extends OAuth2Strategy<User> {
    name = 'google-oidc';

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
                authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
                clientId: options.clientId,
                clientSecret: options.clientSecret,
                redirectURI: options.redirectURI,
                scopes: ['openid', 'email', 'profile'],
                tokenEndpoint: 'https://oauth2.googleapis.com/token',
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
            const { payload } = await jwtVerify<GoogleOIDCClaims>(idToken, googleJwks, {
                audience: clientId,
                issuer: 'https://accounts.google.com',
            });

            if (!payload.sub || !payload.email) throw new Error('Invalid ID token payload');

            return payload;
        } catch (error: unknown) {
            logger.error('Failed to verify Google ID token', { error });
            throw new Error('Invalid ID token', { cause: error });
        }
    }
}
