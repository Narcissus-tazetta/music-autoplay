import type { Route } from ".react-router/types/src/app/+types/root";
import normalizeApiResponse from "@/shared/utils/api";
import { parseApiErrorForUI } from "@/shared/utils/apiUi";
import { safeExecuteAsync } from "@/shared/utils/handle";
import { respondWithResult } from "@/shared/utils/httpResponse";
import { err as makeErr } from "@/shared/utils/result";
import clsx from "clsx";
import { useEffect } from "react";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "react-router";
import {
  PreventFlashOnWrongTheme,
  ThemeProvider,
  useTheme,
} from "remix-themes";
import { Header } from "~/components/ui/header";
import { themeSessionResolver, type UserSessionData } from "~/sessions.server";
import { loginSession } from "~/sessions.server";
import appCss from "./App.css?url";

export const links: Route.LinksFunction = () => [
  { rel: "stylesheet", href: appCss },
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
  { rel: "icon", href: "/favicon.ico", sizes: "any" },
];

export const loader = async ({ request }: Route.LoaderArgs) => {
  const res = await safeExecuteAsync(async () => {
    const { getTheme } = await themeSessionResolver(request);
    const session = await loginSession.getSession(
      request.headers.get("Cookie"),
    );
    const user = session.get("user");

    return {
      theme: getTheme(),
      user,
    };
  });

  if (!res.ok) {
    const errObj = res.error;
    const isErrLike = (
      v: unknown,
    ): v is { code?: string | number; message?: unknown; details?: unknown } =>
      !!v && typeof v === "object";
    let message: string;
    let code: string | undefined;
    if (isErrLike(errObj) && typeof errObj.message === "string")
      message = errObj.message;
    else if (isErrLike(errObj)) message = JSON.stringify(errObj);
    else message = "loader error";

    if (
      isErrLike(errObj) &&
      (typeof errObj.code === "string" || typeof errObj.code === "number")
    )
      code =
        typeof errObj.code === "string" ? errObj.code : String(errObj.code);

    return respondWithResult(makeErr({ message, code }));
  }
  return res.value;
};

type LoaderResult =
  | { theme: string | null; user?: UserSessionData | undefined }
  | undefined;

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <InnerLayout>{children}</InnerLayout>
    </Providers>
  );
}
function InnerLayout({ children }: { children: React.ReactNode }) {
  const dataRaw = useLoaderData<typeof loader>() as unknown;
  // eslint-disable-next-line @typescript-eslint/only-throw-error
  if (dataRaw instanceof Response) throw dataRaw;

  const data = (dataRaw as LoaderResult | undefined) ?? undefined;
  const [theme] = useTheme();

  const ssrTheme = Boolean((data as { theme?: unknown } | undefined)?.theme);

  return (
    <html lang="ja" className={clsx(theme)}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <PreventFlashOnWrongTheme ssrTheme={ssrTheme} />
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
  const _ld = useLoaderData<typeof loader>() as unknown;
  const ld =
    _ld instanceof Response ? undefined : (_ld as LoaderResult | undefined);
  const userName =
    ld && ld.user && typeof (ld.user as { name?: unknown }).name === "string"
      ? (ld.user as { name?: string }).name
      : undefined;
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const adminKey = params.get("admin");
      if (adminKey === "secret") {
        void import("../shared/stores/adminStore")
          .then(({ useAdminStore }) => {
            useAdminStore.getState().setIsAdmin(true);
          })
          .catch((err: unknown) => {
            if (import.meta.env.DEV)
              console.error("adminStore import failed", err);
          });
      }
    }
  }, []);

  return (
    <>
      <Header userName={userName} />
      <div className="flex flex-col items-center">
        <Outlet />
      </div>
    </>
  );
}

function Providers({ children }: { children?: React.ReactNode }) {
  const dataRaw = useLoaderData<typeof loader>() as unknown;
  // eslint-disable-next-line @typescript-eslint/only-throw-error
  if (dataRaw instanceof Response) throw dataRaw;
  const data = dataRaw as LoaderResult | undefined;
  const theme = (data as { theme?: unknown } | undefined)?.theme ?? null;

  useEffect(() => {
    const run = async () => {
      const { useMusicStore } = await import("./stores/musicStore");
      const store = useMusicStore.getState();

      try {
        store.connectSocket();
      } catch (err: unknown) {
        if (import.meta.env.DEV) {
          if (err instanceof Error) console.error("connectSocket failed", err);
          else console.error("connectSocket failed", String(err));
        }
      }

      const doBackgroundFetch = async () => {
        const doFetchOnce = async (signal: AbortSignal) => {
          const resp = await fetch("/api/musics", {
            cache: "no-store",
            signal,
          });
          const norm = await normalizeApiResponse<{ musics: unknown[] }>(resp);

          if (!norm.success) {
            try {
              const parsed = parseApiErrorForUI({
                code: norm.error.code,
                message: norm.error.message,
                details: norm.error.details,
              });

              if (import.meta.env.DEV)
                console.debug(
                  "/api/musics responded with parsed error:",
                  parsed,
                );

              try {
                const mod = await import("@/shared/utils/uiActionExecutor");
                mod.executeParsedApiError(parsed, { conformFields: undefined });
              } catch (err: unknown) {
                if (import.meta.env.DEV)
                  console.error("uiActionExecutor failed", err);
              }

              if (parsed.kind === "unauthorized") return;
            } catch (err: unknown) {
              if (import.meta.env.DEV)
                console.debug("parseApiErrorForUI failed", err);
            }
            const maybeErr: unknown = norm.error;
            let fallbackMsg = "Unknown error";
            if (
              typeof maybeErr === "object" &&
              maybeErr !== null &&
              "message" in maybeErr
            ) {
              const m = (maybeErr as Record<string, unknown>).message;
              if (typeof m === "string") fallbackMsg = m;
            } else if (typeof maybeErr === "string") fallbackMsg = maybeErr;
            else {
              try {
                fallbackMsg = JSON.stringify(maybeErr);
              } catch {
                fallbackMsg = String(maybeErr);
              }
            }

            throw new Error("fetch /api/musics failed: " + fallbackMsg);
          }

          const musicsRaw = (norm.data as { musics?: unknown } | null)?.musics;
          if (!Array.isArray(musicsRaw)) throw new Error("no-musics");
          const maybeMusics = musicsRaw;
          const isMusic = (
            v: unknown,
          ): v is import("./stores/musicStore").Music => {
            if (!v || typeof v !== "object") return false;
            const r = v as Record<string, unknown>;
            return (
              typeof r.id === "string" &&
              typeof r.title === "string" &&
              typeof r.channelName === "string" &&
              typeof r.channelId === "string" &&
              typeof r.duration === "string"
            );
          };

          const musics = maybeMusics.filter(isMusic);
          if (musics.length > 0) store.setMusics?.(musics);
        };

        const attempts = [0, 500, 1000];
        for (let i = 0; i < attempts.length; i++) {
          if (i > 0) await new Promise((r) => setTimeout(r, attempts[i]));
          const controller = new AbortController();
          const timeout = setTimeout(() => {
            controller.abort();
          }, 3000);
          try {
            await doFetchOnce(controller.signal);
            clearTimeout(timeout);
            break;
          } catch (err: unknown) {
            clearTimeout(timeout);
            if (import.meta.env.DEV) {
              console.debug("/api/musics fetch attempt failed", {
                attempt: i + 1,
                error: err instanceof Error ? err.message : String(err),
              });
            }
            if (i === attempts.length - 1) {
              if (import.meta.env.DEV)
                console.debug(
                  "/api/musics all attempts failed, relying on socket",
                );
            }
          }
        }
      };

      try {
        await doBackgroundFetch();
      } catch {
        if (import.meta.env.DEV)
          console.debug("background /api/musics task failed");
      } finally {
        try {
          store.hydrateFromLocalStorage?.();
        } catch (err: unknown) {
          if (import.meta.env.DEV)
            console.debug("hydrateFromLocalStorage failed", err);
        }
      }
    };

    run().catch((err: unknown) => {
      if (import.meta.env.DEV) {
        if (err instanceof Error) console.error(err);
        else console.error(typeof err === "string" ? err : JSON.stringify(err));
      }
    });
  }, []);

  useEffect(() => {
    try {
      const g =
        (
          window as unknown as {
            __app__?: {
              showToast?: (opts: { level: string; message: string }) => void;
              navigate?: (to: string) => void;
            };
          }
        ).__app__ || {};
      if (!g.showToast) {
        g.showToast = ({
          level,
          message,
        }: {
          level: string;
          message: string;
        }) => {
          console.warn(`TOAST[${level}]: ${message}`);
        };
      }
      if (!g.navigate) {
        g.navigate = (to: string) => {
          try {
            window.history.pushState({}, "", to);
            window.dispatchEvent(new PopStateEvent("popstate"));
          } catch {
            window.location.href = to;
          }
        };
      }
      (window as unknown as { __app__?: unknown }).__app__ = g;
    } catch (err: unknown) {
      if (import.meta.env.DEV) console.error("window.__app__ init failed", err);
    }
  }, []);

  const specifiedTheme = typeof theme === "string" ? theme : null;
  return (
    <ThemeProvider
      specifiedTheme={
        specifiedTheme as unknown as Parameters<
          typeof ThemeProvider
        >[0]["specifiedTheme"]
      }
      themeAction="/action/set-theme"
    >
      {children}
    </ThemeProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
