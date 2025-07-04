import DOMPurify from "dompurify";

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html);
}

export function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

export function sanitizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    if (urlObj.protocol === "https:" || urlObj.protocol === "http:") {
      return urlObj.toString();
    }
    return "";
  } catch {
    return "";
  }
}
