"use client";

import { ArrowRight, Check, Clock, Headphones, ShieldCheck, TrendingUp, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { AuthLayout, Stepper } from "@/components/auth-layout";
import { Button } from "@/components/ui";

const HIGHLIGHTS = [
  { icon: TrendingUp, label: "Fixed-term plans with a target return" },
  { icon: ShieldCheck, label: "Verified accounts, transparent payouts" },
  { icon: Headphones, label: "24/7 support" },
];

const OUTCOMES = {
  approved: {
    icon: Check,
    tone: "text-brand",
    bg: "bg-brand/12",
    title: "You're verified",
    body: "Your identity has been confirmed. Your account is fully active.",
  },
  declined: {
    icon: X,
    tone: "text-danger",
    bg: "bg-danger/12",
    title: "We couldn't verify you",
    body: "Your documents didn't pass our checks. You can try again from your settings.",
  },
  pending: {
    icon: Clock,
    tone: "text-warn",
    bg: "bg-warn/12",
    title: "Thanks — we're reviewing",
    body: "Your submission is with our verification partner. We'll email you as soon as there's a decision.",
  },
} as const;

function outcomeFor(status: string | null): keyof typeof OUTCOMES {
  if (status === "Approved") return "approved";
  if (status === "Declined" || status === "Kyc Expired") return "declined";
  return "pending";
}

function CompleteContent() {
  const params = useSearchParams();
  const router = useRouter();
  // The webhook is what actually updates the account; this status is only here so the
  // returning user sees the right message straight away.
  const outcome = OUTCOMES[outcomeFor(params.get("status"))];
  const Icon = outcome.icon;

  return (
    <AuthLayout
      headline="Thanks for verifying."
      subhead="Identity checks keep every account on the platform genuine and your funds protected."
      highlights={HIGHLIGHTS}
    >
      <Stepper steps={["Account", "Identity", "Done"]} current={2} className="mb-9" />

      <div className="text-center">
        <span
          className={`mx-auto flex size-16 items-center justify-center rounded-full ${outcome.bg} ${outcome.tone}`}
        >
          <Icon className="size-8" strokeWidth={3} />
        </span>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">{outcome.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">{outcome.body}</p>
      </div>

      <Button className="mt-8 w-full" size="lg" onClick={() => router.push("/dashboard")}>
        Go to dashboard
        <ArrowRight className="size-4" />
      </Button>

      <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-faint">
        <Headphones className="size-3.5" />
        Need help? Contact our support team 24/7
      </p>
    </AuthLayout>
  );
}

export default function VerifyCompletePage() {
  return (
    <Suspense
      fallback={<div className="flex min-h-screen items-center justify-center text-muted">Loading…</div>}
    >
      <CompleteContent />
    </Suspense>
  );
}
