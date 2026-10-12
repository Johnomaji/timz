"use client";

import { themeScript } from "@/lib/theme";
import "./globals.css";

// Replaces the root layout entirely, so this file owns the document, the stylesheet
// and the theme attribute — none of the providers above it are mounted.
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <title>Something went wrong — Vestage</title>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body
        className="flex min-h-screen items-center justify-center bg-base px-5 py-20"
        style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif" }}
      >
        <div className="w-full max-w-md rounded-xl2 border border-line bg-surface p-8 text-center">
          <h1 className="text-xl font-semibold tracking-tight text-ink">Something went wrong</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Vestage failed to load. Your balance and investments are not affected.
          </p>

          {error.digest && (
            <p className="mt-4 font-mono text-xs text-faint">Reference: {error.digest}</p>
          )}

          <button
            onClick={() => retry()}
            className="mt-7 inline-flex items-center justify-center rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-brand-ink transition-all duration-150 active:scale-[0.98]"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
