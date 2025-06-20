import { useEffect, useState } from "react";
import { useGamingToggle } from "~/hooks/use-gaming-toggle";
import { useLocation } from "react-router";

export const Footer: React.FC = () => {
  const [mode, setMode] = useState<"dark" | "light">("light");
  const gamingAlinco = useGamingToggle("^");
  const gamingNarcissus = useGamingToggle("¥");
  const location = typeof window !== "undefined" ? window.location.pathname : "";

  useEffect(() => {
    const updateMode = () => {
      if (document.body.classList.contains("dark")) setMode("dark");
      else setMode("light");
    };
    updateMode();
    const observer = new MutationObserver(updateMode);
    observer.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  const bg = mode === "dark" ? "#212225" : "#fff";
  const fg = mode === "dark" ? "#E8EAED" : "#212225";
  const border = mode === "dark" ? "#444" : "#e5e7eb";

  return (
    <footer
      className="footer w-full py-2 flex flex-col items-center justify-center text-[11px] opacity-80 fixed left-0 bottom-0 z-50"
      style={{
        background: bg,
        color: fg,
        boxShadow: "0 -2px 12px 0 rgba(0,0,0,0.04)",
        borderTop: `1px solid ${border}`,
        transition:
          "background 0.2s cubic-bezier(0.4,0,0.2,1), color 0.2s cubic-bezier(0.4,0,0.2,1)",
      }}
    >
      {location !== "/time" && (
        <div className="leading-tight">
          supported by{" "}
          <a
            href="https://github.com/alinco8"
            className={`text-blue-500 hover:underline mx-1${gamingAlinco ? " gaming-color" : ""}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ transition: "color 0.2s" }}
          >
            alinco8
          </a>
        </div>
      )}
      <div className="text-[10px] mt-1 opacity-70 select-none leading-tight">
        &copy; {new Date().getFullYear()}{" "}
        <a
          href="https://github.com/Narcissus-tazetta"
          target="_blank"
          rel="noopener noreferrer"
          className={`footer-link-normal${gamingNarcissus ? " gaming-color" : ""}`}
        >
          Narcissus-tazetta
        </a>
      </div>
    </footer>
  );
};
