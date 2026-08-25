import { serverContext } from '@/server/context';
import { createReadableStreamFromReadable } from '@react-router/node';
import { isbot } from 'isbot';
import { PassThrough } from 'node:stream';
import type { RenderToPipeableStreamOptions } from 'react-dom/server';
import { renderToPipeableStream } from 'react-dom/server';
import type { EntryContext, RouterContextProvider } from 'react-router';
import { ServerRouter } from 'react-router';

export const streamTimeout = 5_000;

/**
 * Exists for the CSP nonce. It has to be applied in two places: `ServerRouter` covers the
 * router's own inline scripts, and `renderToPipeableStream`'s option covers the ones React
 * injects while streaming. Missing either leaves inline scripts blocked once `script-src`
 * drops `'unsafe-inline'`. Everything else is the framework default.
 */
export default function handleRequest(
    request: Request,
    responseStatusCode: number,
    responseHeaders: Headers,
    routerContext: EntryContext,
    loadContext: RouterContextProvider,
) {
    // https://httpwg.org/specs/rfc9110.html#HEAD
    if (request.method.toUpperCase() === 'HEAD') {
        return new Response(null, {
            status: responseStatusCode,
            headers: responseHeaders,
        });
    }

    const nonce = loadContext.get(serverContext).cspNonce;

    return new Promise((resolve, reject) => {
        let shellRendered = false;
        const userAgent = request.headers.get('user-agent');

        // Bots and SPA Mode renders wait for all content before responding.
        const readyOption: keyof RenderToPipeableStreamOptions = (userAgent && isbot(userAgent))
                || routerContext.isSpaMode
            ? 'onAllReady'
            : 'onShellReady';

        let timeoutId: ReturnType<typeof setTimeout> | undefined = setTimeout(
            () => abort(),
            streamTimeout + 1000,
        );

        const { pipe, abort } = renderToPipeableStream(
            <ServerRouter context={routerContext} url={request.url} nonce={nonce} />,
            {
                [readyOption]() {
                    shellRendered = true;
                    const body = new PassThrough({
                        final(callback) {
                            clearTimeout(timeoutId);
                            timeoutId = undefined;
                            callback();
                        },
                    });
                    const stream = createReadableStreamFromReadable(body);

                    responseHeaders.set('Content-Type', 'text/html');

                    pipe(body);

                    resolve(
                        new Response(stream, {
                            headers: responseHeaders,
                            status: responseStatusCode,
                        }),
                    );
                },
                nonce,
                onShellError(error: unknown) {
                    reject(error);
                },
                onError(error: unknown) {
                    responseStatusCode = 500;
                    // Shell errors reject above and are logged by handleDocumentRequest.
                    if (shellRendered) console.error(error);
                },
            },
        );
    });
}
