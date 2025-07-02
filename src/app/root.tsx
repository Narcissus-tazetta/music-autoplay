import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import { useEffect } from "react";

import type { Route } from "./+types/root";
import appCss from "../shared/App.css?url";
import { useColorModeStore } from "../features/settings/stores/colorModeStore";

export const links: Route.LinksFunction = () => [
  { rel: "stylesheet", href: appCss },
  { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
  { rel: "icon", href: "/favicon.ico", sizes: "any" }, // fallback
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        {/* ダークモードのちらつき防止 - 高速化 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('color-mode-storage');
                  if (stored) {
                    var data = JSON.parse(stored);
                    var mode = data.state && data.state.mode;
                    if (mode === 'dark') {
                      var html = document.documentElement;
                      var body = document.body;
                      html.classList.add('dark');
                      body.classList.add('dark');
                      body.style.cssText = 'background-color:#212225;color:#E8EAED;transition:none';
                    } else if (mode === 'light') {
                      document.body.style.cssText = 'background-color:#fff;color:#212225;transition:none';
                    }
                  } else {
                    document.body.style.cssText = 'background-color:#fff;color:#212225;transition:none';
                  }
                } catch (e) {
                  document.body.style.cssText = 'background-color:#fff;color:#212225;transition:none';
                }
              })();
            `,
          }}
        />
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
  const { hasHydrated } = useColorModeStore();

  useEffect(() => {
    // ハイドレーション完了後に一度だけトランジションを有効化
    if (hasHydrated && typeof window !== "undefined") {
      const body = document.body;
      if (body.style.transition === "none") {
        // 少し遅延してからトランジションを有効化
        setTimeout(() => {
          body.style.transition =
            "background-color 0.2s cubic-bezier(0.4,0,0.2,1), color 0.2s cubic-bezier(0.4,0,0.2,1)";
        }, 100);
      }
    }
  }, [hasHydrated]);

  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404 ? "The requested page could not be found." : error.statusText || details;
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
