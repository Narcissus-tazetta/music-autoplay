import { SERVER_ENV } from '@/server/env.server';
import type { UserSessionData } from '@/server/sessions.server';
import { Authenticator } from 'remix-auth';
import { GoogleOIDCStrategy } from '~/auth/auth-google.server';

export const authenticator = new Authenticator<UserSessionData>();

authenticator.use(
    new GoogleOIDCStrategy(
        {
            clientId: SERVER_ENV.GOOGLE_CLIENT_ID,
            clientSecret: SERVER_ENV.GOOGLE_CLIENT_SECRET,
            redirectURI: `${SERVER_ENV.CLIENT_URL}/auth/google-callback`,
        },
        profile => {
            if (!profile.email_verified) throw new Error('メールアドレスが確認されていません。');

            return {
                email: profile.email,
                id: profile.sub,
                name: profile.name,
            };
        },
    ),
);
