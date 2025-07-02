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
