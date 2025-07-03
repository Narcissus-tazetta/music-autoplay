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
  { rel: "icon", href: "/favicon.ico", sizes: "any" },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('color-mode-storage');
                  var mode = 'light';
                  
                  if (stored) {
                    var data = JSON.parse(stored);
                    mode = (data.state && data.state.mode) || 'light';
                  }
                  
                  var html = document.documentElement;
                  
                  if (mode === 'dark') {
                    html.style.setProperty('--color-bg', '#212225');
                    html.style.setProperty('--color-fg', '#E8EAED');
                    html.style.setProperty('--color-border', '#444');
                  } else {
                    html.style.setProperty('--color-bg', '#fff');
                    html.style.setProperty('--color-fg', '#212225');
                    html.style.setProperty('--color-border', '#e5e7eb');
                  }
                  
                  function applyBodyStyles() {
                    var body = document.body;
                    if (!body) return;
                    
                    if (mode === 'dark') {
                      body.style.setProperty('background-color', '#212225', 'important');
                      body.style.setProperty('color', '#E8EAED', 'important');
                    } else {
                      body.style.setProperty('background-color', '#fff', 'important');
                      body.style.setProperty('color', '#212225', 'important');
                    }
                    body.style.setProperty('transition', 'none', 'important');
                  }
                  
                  applyBodyStyles();
                  if (!document.body) {
                    document.addEventListener('DOMContentLoaded', applyBodyStyles);
                  }
                } catch (e) {
                  var html = document.documentElement;
                  html.style.setProperty('--color-bg', '#fff');
                  html.style.setProperty('--color-fg', '#212225');
                  html.style.setProperty('--color-border', '#e5e7eb');
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
  const mode = useColorModeStore((state) => state.mode);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const body = document.body;
      const html = document.documentElement;

      const colors =
        mode === "dark" ? { bg: "#212225", fg: "#E8EAED" } : { bg: "#fff", fg: "#212225" };
      const borderColor = mode === "dark" ? "#444" : "#e5e7eb";

      if (mode === "dark") {
        html.classList.add("dark");
        body.classList.add("dark");
      } else {
        html.classList.remove("dark");
        body.classList.remove("dark");
      }

      // インラインスタイルでbodyの色を確実に設定
      body.style.setProperty("background-color", colors.bg, "important");
      body.style.setProperty("color", colors.fg, "important");

      html.style.setProperty("--color-bg", colors.bg);
      html.style.setProperty("--color-fg", colors.fg);
      html.style.setProperty("--color-border", borderColor);

      const transition =
        "background-color 0.2s cubic-bezier(0.4,0,0.2,1), color 0.2s cubic-bezier(0.4,0,0.2,1), border-color 0.2s cubic-bezier(0.4,0,0.2,1)";
      html.style.setProperty("--transition-colors", transition);

      // トランジション設定は少し遅延させる
      setTimeout(() => {
        body.style.setProperty("transition", transition, "important");
      }, 50);
    }
  }, [mode]);

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
