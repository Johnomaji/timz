"use client";

import {
  AlertCircle,
  ArrowRight,
  Check,
  Clock,
  FileText,
  Headphones,
  Lock,
  ScanFace,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthLayout, Stepper } from "@/components/auth-layout";
import { Button } from "@/components/ui";
import { useStore } from "@/lib/store";

const HIGHLIGHTS = [
  { icon: TrendingUp, label: "Fixed-term plans with a target return" },
  { icon: ShieldCheck, label: "Verified accounts, transparent payouts" },
  { icon: Headphones, label: "24/7 support" },
];

const STEPS = ["Account", "Identity", "Done"];

const REQUIREMENTS = [
  { icon: FileText, title: "Government ID", body: "Passport, driver's licence or national ID" },
  { icon: ScanFace, title: "A quick selfie", body: "Confirms the document belongs to you" },
  { icon: Clock, title: "About two minutes", body: "Most checks complete immediately" },
];

const NEXT_STEPS = [
  "Add funds with crypto",
  "Choose a lock plan",
  "Start earning on maturity",
];

export default function VerifyPage() {
  const { currentUser, setKycStatus } = useStore();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!currentUser) router.replace("/login");
  }, [currentUser, router]);

  if (!currentUser) {
    return <div className="flex min-h-screen items-center justify-center text-muted">Redirecting…</div>;
  }

  const start = async () => {
    setError("");
    setBusy(true);
    try {
      const response = await fetch("/api/kyc/session", { method: "POST" });

      if (response.ok) {
        const { url } = (await response.json()) as { url: string };
        window.location.href = url;
        return;
      }

      // 503 means Didit keys are absent (demo deployments), 401 means there is no
      // Supabase session because the app is running off the localStorage store.
      if (response.status === 503 || response.status === 401) {
        setKycStatus("approved");
        setBusy(false);
        return;
      }

      const { error: message } = (await response.json()) as { error?: string };
      setError(message ?? "Could not start verification.");
    } catch {
      setError("Could not reach the verification service. Try again.");
    }
    setBusy(false);
  };

  if (currentUser.kycStatus === "approved") {
    return (
      <AuthLayout
        headline="You're all set."
        subhead="Your identity is confirmed and your account is ready to fund."
        highlights={HIGHLIGHTS}
      >
        <div className="text-center">
          <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-brand/12 text-brand">
            <Check className="size-8" strokeWidth={3} />
          </span>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">Welcome to Vestage!</h1>
          <p className="mt-2 text-sm text-muted">
            Your account has been successfully created and verified.
          </p>
        </div>

        <div className="mt-7 rounded-xl2 border border-line bg-surface-2/50 p-5 text-left">
          <p className="text-sm font-semibold text-ink">Next steps</p>
          <ol className="mt-3 space-y-3">
            {NEXT_STEPS.map((step, index) => (
              <li key={step} className="flex items-center gap-3 text-sm text-muted">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand/15 text-xs font-semibold text-brand">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>

        <Button className="mt-6 w-full" size="lg" onClick={() => router.replace("/dashboard")}>
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

  if (currentUser.kycStatus === "pending") {
    return (
      <AuthLayout
        headline="Almost there."
        subhead="We're reviewing the documents you submitted. This usually takes just a few minutes."
        highlights={HIGHLIGHTS}
      >
        <Stepper steps={STEPS} current={1} className="mb-9" />
        <div className="text-center">
          <span className="animate-ring mx-auto flex size-16 items-center justify-center rounded-full bg-warn/12 text-warn">
            <Clock className="size-7" />
          </span>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">Verification in review</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            Your documents are with our verification partner. We&apos;ll email you as soon as
            there&apos;s a decision — you can keep using your account in the meantime.
          </p>
        </div>

        <Button
          variant="outline"
          className="mt-7 w-full"
          size="lg"
          onClick={() => router.replace("/dashboard")}
        >
          Continue to dashboard
        </Button>
      </AuthLayout>
    );
  }

  const declined = currentUser.kycStatus === "declined";

  return (
    <AuthLayout
      headline="Verify your identity."
      subhead="A one-time check keeps your account secure and compliant. Your documents are encrypted and only used for verification."
      highlights={HIGHLIGHTS}
    >
      <Stepper steps={STEPS} current={1} className="mb-9" />

      <h1 className="text-2xl font-semibold tracking-tight">
        {declined ? "Let's try that again" : "Verify your identity"}
      </h1>
      <p className="mt-1.5 text-sm leading-relaxed text-muted">
        {declined
          ? "We couldn't confirm your previous submission. Make sure your document is clear, uncropped and well lit."
          : "You'll be taken to our verification partner, Didit, to upload your ID and take a short selfie."}
      </p>

      <ul className="mt-7 space-y-3">
        {REQUIREMENTS.map(({ icon: Icon, title, body }) => (
          <li
            key={title}
            className="flex items-start gap-3 rounded-xl border border-line bg-surface-2/50 px-4 py-3.5"
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/12 text-brand">
              <Icon className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-ink">{title}</span>
              <span className="block text-xs text-muted">{body}</span>
            </span>
          </li>
        ))}
      </ul>

      {error && (
        <div className="mt-5 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          {error}
        </div>
      )}

      <Button className="mt-6 w-full" size="lg" loading={busy} onClick={() => void start()}>
        {declined ? "Retry verification" : "Start verification"}
        <ArrowRight className="size-4" />
      </Button>

      <Link
        href="/dashboard"
        className="mt-4 flex items-center justify-center gap-1.5 text-sm text-muted transition-colors hover:text-ink"
      >
        <Wallet className="size-4" />
        Skip for now — I&apos;ll verify later
      </Link>

      <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-faint">
        <Lock className="size-3" />
        Your documents are encrypted and only used for verification
      </p>
    </AuthLayout>
  );
}
