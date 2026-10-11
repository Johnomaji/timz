"use client";

import { ArrowRight, Clock, ShieldAlert, ShieldX } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { useStore } from "@/lib/store";
import type { KycStatus } from "@/lib/types";
import { Button } from "./ui";

/** Dashboard routes that stay usable while the account is unverified. */
export const OPEN_WHILE_UNVERIFIED = ["/dashboard/settings", "/dashboard/notifications"];

export function isOpenWhileUnverified(pathname: string) {
  return OPEN_WHILE_UNVERIFIED.some((prefix) => pathname.startsWith(prefix));
}

const COPY = {
  unverified: {
    icon: ShieldAlert,
    tone: "bg-brand/15 text-brand",
    title: "Verify your identity to continue",
    body: "Deposits, plans and withdrawals unlock once your identity check passes. It takes about two minutes.",
    cta: "Verify now",
  },
  pending: {
    icon: Clock,
    tone: "bg-warn/15 text-warn",
    title: "Verification in review",
    body: "Your documents are with our verification partner. Your account unlocks automatically as soon as there's a decision.",
    cta: null,
  },
  declined: {
    icon: ShieldX,
    tone: "bg-danger/15 text-danger",
    title: "Verification unsuccessful",
    body: "We couldn't confirm your documents. Submit again with a clear, uncropped photo of your ID to unlock your account.",
    cta: "Try again",
  },
} satisfies Record<Exclude<KycStatus, "approved">, unknown>;

/**
 * Renders the page greyed out and inert behind a verification prompt until KYC passes.
 * The real content stays mounted so the user can see what they are unlocking.
 */
export function VerificationGate({ children }: { children: ReactNode }) {
  const { currentUser } = useStore();

  if (!currentUser || currentUser.kycStatus === "approved") return <>{children}</>;

  const { icon: Icon, tone, title, body, cta } = COPY[currentUser.kycStatus];

  return (
    <div className="relative min-h-[32rem]">
      <div inert className="pointer-events-none opacity-40 select-none grayscale">
        {children}
      </div>

      <div className="absolute inset-0 flex justify-center px-4">
        <div className="shadow-pop sticky top-28 h-fit w-full max-w-md rounded-xl2 border border-line bg-surface p-7 text-center">
          <span className={`mx-auto flex size-14 items-center justify-center rounded-2xl ${tone}`}>
            <Icon className="size-7" />
          </span>
          <h2 className="mt-5 text-xl font-semibold tracking-tight text-ink">{title}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>

          {cta && (
            <Link href="/verify" className="mt-6 block">
              <Button className="w-full" size="lg">
                {cta}
                <ArrowRight className="size-4" />
              </Button>
            </Link>
          )}

          <p className="mt-5 text-xs text-faint">
            You can still read your{" "}
            <Link href="/dashboard/notifications" className="text-muted hover:text-ink">
              notifications
            </Link>{" "}
            and update your{" "}
            <Link href="/dashboard/settings" className="text-muted hover:text-ink">
              settings
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
