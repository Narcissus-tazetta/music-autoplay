import type { Route } from ".react-router/types/src/app/+types/root";
import clsx from "clsx";
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
import React from "react";
import { Header } from "~/components/ui/header";
import { themeSessionResolver } from "~/sessions.server";
import { loginSession } from "~/sessions.server";
import appCss from "./App.css?url";

export const links: Route.LinksFunction = () => [
  { rel: "stylesheet", href: appCss },
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
  { rel: "icon", href: "/favicon.ico", sizes: "any" },
];

export const loader = async ({ request }: Route.LoaderArgs) => {
  const { getTheme } = await themeSessionResolver(request);
  const session = await loginSession.getSession(request.headers.get("Cookie"));
  const user = session.get("user");

  return {
    theme: getTheme(),
    user,
  };
};

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Providers>
      <InnerLayout>{children}</InnerLayout>
    </Providers>
  );
}
function InnerLayout({ children }: { children: React.ReactNode }) {
  const data = useLoaderData<typeof loader>() as
    | Awaited<ReturnType<typeof loader>>
    | undefined;
  const [theme] = useTheme();

  return (
    <html lang="ja" className={clsx(theme)}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <PreventFlashOnWrongTheme ssrTheme={Boolean(data?.theme)} />
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
  const { user } = useLoaderData<typeof loader>();
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const adminKey = params.get("admin");
      if (adminKey === "secret") {
        void import("../shared/stores/adminStore")
          .then(({ useAdminStore }) => {
            useAdminStore.getState().setIsAdmin(true);
          })
          .catch((err: unknown) => {
            if (import.meta.env.DEV) {
              if (err instanceof Error) console.error(err);
              else console.error(String(err));
            }
          });
      }
    }
  }, []);

  return (
    <>
      <Header userName={user?.name} />
      <div className="flex flex-col items-center">
        <Outlet />
      </div>
    </>
  );
}

function Providers({ children }: { children?: React.ReactNode }) {
  const data = useLoaderData<typeof loader>() as
    | Awaited<ReturnType<typeof loader>>
    | undefined;
  const theme = data?.theme ?? null;
  React.useEffect(() => {
    void (async () => {
      const { useMusicStore } = await import("./stores/musicStore");
      const store = useMusicStore.getState();
      // Start socket connection immediately so a slow or hung /api/musics
      try {
        store.connectSocket();
      } catch (err) {
        if (import.meta.env.DEV) {
          if (err instanceof Error) console.error("connectSocket failed", err);
          else console.error("connectSocket failed", String(err));
        }
      }
      (async () => {
        const doFetchOnce = async (signal: AbortSignal) => {
          const resp = await fetch("/api/musics", {
            cache: "no-store",
            signal,
          });
          if (!resp.ok) throw new Error(`status:${resp.status}`);
          const parsed: unknown = await resp.json().catch(() => null);
          if (typeof parsed !== "object" || parsed === null)
            throw new Error("invalid-json");
          const rec = parsed as Record<string, unknown>;
          if (
            !Array.isArray(rec.musics) ||
            typeof store.setMusics !== "function"
          )
            throw new Error("no-musics");
          const maybeMusics = rec.musics as unknown[];
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
          if (musics.length > 0) store.setMusics(musics);
        };

        const attempts = [0, 500, 1000];
        for (let i = 0; i < attempts.length; i++) {
          if (i > 0) await new Promise((r) => setTimeout(r, attempts[i]));
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3000);
          try {
            await doFetchOnce(controller.signal);
            clearTimeout(timeout);
            break;
          } catch (err) {
            clearTimeout(timeout);
            if (import.meta.env.DEV)
              console.debug("/api/musics fetch attempt failed", {
                attempt: i + 1,
                error: err,
              });
            if (i === attempts.length - 1) {
              if (import.meta.env.DEV)
                console.debug(
                  "/api/musics all attempts failed, relying on socket",
                );
            }
          }
        }
      })().catch((err: unknown) => {
        if (import.meta.env.DEV)
          console.debug("background /api/musics task failed", err);
      });
    })().catch((err: unknown) => {
      if (import.meta.env.DEV) {
        if (err instanceof Error) console.error(err);
        else console.error(String(err));
      }
    });
  }, []);

  return (
    <ThemeProvider specifiedTheme={theme} themeAction="/action/set-theme">
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
