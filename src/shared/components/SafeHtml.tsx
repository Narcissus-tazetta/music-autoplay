import React from "react";
import { sanitizeHtml } from "../libs/sanitize";

interface SafeHtmlProps {
  html: string;
  className?: string;
  tag?: keyof React.JSX.IntrinsicElements;
}

export function SafeHtml({ html, className, tag = "div" }: SafeHtmlProps) {
  const sanitizedHtml = sanitizeHtml(html);

  return React.createElement(tag, {
    className,
    dangerouslySetInnerHTML: { __html: sanitizedHtml }
  });
}
