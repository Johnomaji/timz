"use client";

import { ArrowLeft, type LucideIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { Brand } from "./shell";
import { ThemeToggle } from "./ui";

/**
 * Split-panel frame for the signed-out pages: a fixed dark promo panel on the left and
 * the live form on the right. The promo panel keeps the dark palette in both themes
 * (see the `promo-panel` utility) because it reads as artwork rather than chrome.
 */
export function AuthLayout({
  headline,
  subhead,
  highlights,
  children,
}: {
  headline: ReactNode;
  subhead: string;
  highlights: { icon: LucideIcon; label: string }[];
  children: ReactNode;
}) {
  const { db } = useStore();

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <aside className="promo-panel glow-grid relative hidden overflow-hidden lg:flex lg:w-[44%] lg:max-w-2xl lg:flex-col lg:justify-between lg:p-12">
        <Link href="/" className="relative z-10 w-fit">
          <Brand />
        </Link>

        <div className="relative z-10 max-w-md">
          <h2 className="text-4xl font-semibold tracking-tight text-ink">{headline}</h2>
          <p className="mt-4 leading-relaxed text-muted">{subhead}</p>

          <ul className="mt-9 space-y-4">
            {highlights.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-3 text-sm text-ink">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-line bg-surface-2 text-brand">
                  <Icon className="size-4" />
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-faint">
          Capital is at risk. Returns are targets, not guarantees.
        </p>

        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -bottom-24 size-96 rounded-full bg-brand/20 blur-3xl"
        />
      </aside>

      <main className="flex flex-1 flex-col px-5 py-8 sm:px-8">
        <div className="mb-8 flex items-center justify-between gap-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-muted transition-colors hover:text-ink"
          >
            <ArrowLeft className="size-4" />
            <span className="lg:hidden">{db.settings.platformName}</span>
            <span className="hidden lg:inline">Back to site</span>
          </Link>
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center">
          <div className="animate-rise w-full max-w-md">{children}</div>
        </div>
      </main>
    </div>
  );
}

/** Horizontal progress rail used by the verification flow. */
export function Stepper({
  steps,
  current,
  className,
}: {
  steps: string[];
  /** Zero-based index of the active step. */
  current: number;
  className?: string;
}) {
  return (
    <ol className={cn("flex items-start", className)}>
      {steps.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={label} className="relative flex flex-1 flex-col items-center">
            {/* Spans from the previous circle's centre to this one, so labels stay centred. */}
            {index > 0 && (
              <span
                aria-hidden
                className={cn(
                  "absolute top-3.5 -left-1/2 h-px w-full",
                  done || active ? "bg-brand" : "bg-line",
                )}
              />
            )}
            <span
              aria-current={active ? "step" : undefined}
              className={cn(
                "relative z-10 flex size-7 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                done && "border-brand bg-brand text-brand-ink",
                active && "border-brand bg-brand/12 text-brand",
                !done && !active && "border-line bg-surface-2 text-faint",
              )}
            >
              {done ? "✓" : index + 1}
            </span>
            <span
              className={cn(
                "mt-2 px-1 text-center text-xs",
                active ? "font-medium text-ink" : "text-faint",
              )}
            >
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
