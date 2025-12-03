import { safeExecuteAsync } from '@/shared/utils/errors';
import { err as makeErr } from '@/shared/utils/errors/result-handlers';
import { respondWithResult } from '@/shared/utils/httpResponse';
import clsx from 'clsx';
import type { LinksFunction, LoaderFunctionArgs } from 'react-router';
import {
    isRouteErrorResponse,
    Links,
    Meta,
    Outlet,
    Scripts,
    ScrollRestoration,
    useLoaderData,
    useRouteError,
} from 'react-router';
import { PreventFlashOnWrongTheme, ThemeProvider, useTheme } from 'remix-themes';
import { Header } from '~/components/ui/Header';
import { themeSessionResolver, type UserSessionData } from '~/sessions.server';
import { loginSession } from '~/sessions.server';
import appCss from './App.css?url';
import { useAdminKeyActivation } from './hooks/useAdminKeyActivation';
import { useAppInitialization } from './hooks/useAppInitialization';
import { useWindowAppApi } from './hooks/useWindowAppApi';

export const links: LinksFunction = () => [
    { rel: 'stylesheet', href: appCss },
    { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
    { rel: 'icon', href: '/favicon.ico', sizes: 'any' },
];

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const res = await safeExecuteAsync(async () => {
        const { getTheme } = await themeSessionResolver(request);
        const session = await loginSession.getSession(
            request.headers.get('Cookie'),
        );
        const user = session.get('user');

        return {
            theme: getTheme(),
            user,
        };
    });

    if (!res.ok) {
        const errObj = res.error;
        const isErrLike = (
            v: unknown,
        ): v is { code?: string | number; message?: unknown; details?: unknown } => !!v && typeof v === 'object';
        let message: string;
        let code: string | undefined;
        if (isErrLike(errObj) && typeof errObj.message === 'string') message = errObj.message;
        else if (isErrLike(errObj)) message = JSON.stringify(errObj);
        else message = 'loader error';

        if (
            isErrLike(errObj)
            && (typeof errObj.code === 'string' || typeof errObj.code === 'number')
        ) {
            code = typeof errObj.code === 'string' ? errObj.code : String(errObj.code);
        }

        return respondWithResult(makeErr({ message, code }));
    }
    return res.value;
};

type LoaderResult =
    | { theme: string | null; user?: UserSessionData | undefined }
    | undefined;

function isLoaderData(data: unknown): data is LoaderResult {
    if (!data) return true;
    if (typeof data !== 'object') return false;
    const d = data as Record<string, unknown>;
    return !('theme' in d) || typeof d.theme === 'string' || d.theme === null;
}

export function Layout({ children }: { children: React.ReactNode }) {
    return (
        <Providers>
            <InnerLayout>{children}</InnerLayout>
        </Providers>
    );
}
function InnerLayout({ children }: { children: React.ReactNode }) {
    const dataRaw = useLoaderData<typeof loader>() as unknown;
    if (dataRaw instanceof Response) throw new Error('Response received instead of data');

    const data = isLoaderData(dataRaw) ? dataRaw : undefined;
    const [theme] = useTheme();

    return (
        <html lang='ja' className={clsx(theme)}>
            <head>
                <meta charSet='utf-8' />
                <meta name='viewport' content='width=device-width, initial-scale=1' />
                <Meta />
                <PreventFlashOnWrongTheme ssrTheme={!!data?.theme} />
                <Links />
            </head>
            <body>
                {children}
                <ScrollRestoration />
                <Scripts />
            </body>
        </html>
    );
}

export default function App() {
    const dataRaw = useLoaderData<typeof loader>() as unknown;
    const data = dataRaw instanceof Response
        ? undefined
        : isLoaderData(dataRaw)
        ? dataRaw
        : undefined;

    const userName = data?.user?.name;
    useAdminKeyActivation();

    return (
        <>
            <Header userName={userName} />
            <div className='flex flex-col items-center min-h-screen'>
                <Outlet />
            </div>
        </>
    );
}

function Providers({ children }: { children?: React.ReactNode }) {
    const dataRaw = useLoaderData<typeof loader>() as unknown;
    if (dataRaw instanceof Response) throw new Error('Response received instead of data');

    const data = isLoaderData(dataRaw) ? dataRaw : undefined;
    const theme = data?.theme ?? null;
    useAppInitialization();
    useWindowAppApi();

    const specifiedTheme = typeof theme === 'string' ? theme : null;
    return (
        <ThemeProvider
            specifiedTheme={specifiedTheme as unknown as Parameters<
                typeof ThemeProvider
            >[0]['specifiedTheme']}
            themeAction='/action/set-theme'
        >
            {children}
        </ThemeProvider>
    );
}

export function ErrorBoundary() {
    const error = useRouteError();
    let message = 'Oops!';
    let details = 'An unexpected error occurred.';
    let stack: string | undefined;

    if (isRouteErrorResponse(error)) {
        message = error.status === 404 ? '404' : 'Error';
        details = error.status === 404
            ? 'The requested page could not be found.'
            : error.statusText || details;
    } else if (import.meta.env.DEV && error && error instanceof Error) {
        details = error.message;
        stack = error.stack;
    }

    return (
        <main className='pt-16 p-4 container mx-auto'>
            <h1>{message}</h1>
            <p>{details}</p>
            {stack && (
                <pre className='w-full p-4 overflow-x-auto'>
          <code>{stack}</code>
                </pre>
            )}
        </main>
    );
}
