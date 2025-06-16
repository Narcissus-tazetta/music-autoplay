export const COLORS = {
  dark: {
    background: "#212225",
    text: "#E8EAED",
    buttonBackground: "#E8EAED",
    buttonText: "#212225",
  },
  light: {
    background: "#fff",
    text: "#212225",
    buttonBackground: "#212225",
    buttonText: "#fff",
  },
};

import { useEffect, useRef } from "react";
export function useSmoothBodyColor(bg: string, fg: string) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      document.body.style.transition = "";
      document.body.style.backgroundColor = bg;
      document.body.style.color = fg;
      first.current = false;
    } else {
      document.body.style.transition =
        "background-color 0.2s cubic-bezier(0.4,0,0.2,1), color 0.2s cubic-bezier(0.4,0,0.2,1)";
      document.body.style.backgroundColor = bg;
      document.body.style.color = fg;
    }
    return () => {
      document.body.style.transition = "";
    };
  }, [bg, fg]);
}

export function changeMode(mode: "dark" | "light") {
  document.body.classList.remove("dark-mode", "light-mode");
  document.body.classList.add(mode === "dark" ? "dark-mode" : "light-mode");
  localStorage.setItem("selectedMode", mode);
}

export const YOUTUBE_PATTERN =
  /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?/ ]{11})/i;
export function parseYoutubeUrl(url: string): string | null {
  return url.match(YOUTUBE_PATTERN)?.[1] ?? null;
}
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
