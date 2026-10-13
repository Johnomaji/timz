"use client";

import { AlertCircle, ArrowLeft, Headphones, Mail, ShieldCheck, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AuthLayout } from "@/components/auth-layout";
import { Button, Field, Input } from "@/components/ui";
import { requestPasswordReset } from "@/lib/supabase/auth";
import { usingSupabase } from "@/lib/supabase/config";

const HIGHLIGHTS = [
  { icon: TrendingUp, label: "Fixed-term plans with a target return" },
  { icon: ShieldCheck, label: "Verified accounts, transparent payouts" },
  { icon: Headphones, label: "24/7 support" },
];

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);

    if (!usingSupabase) {
      setError("Password reset needs a live account. Demo profiles sign in from the login page.");
      setBusy(false);
      return;
    }

    const result = await requestPasswordReset(email);
    setBusy(false);
    // Shown even for addresses with no account, so this can't confirm who's a customer.
    if (result.ok) setSent(true);
    else setError(result.error ?? "Could not send the reset email. Try again shortly.");
  };

  if (sent) {
    return (
      <AuthLayout
        headline="Check your inbox."
        subhead="Reset links expire after an hour, so open it while it's fresh."
        highlights={HIGHLIGHTS}
      >
        <div className="text-center">
          <span className="animate-ring mx-auto flex size-16 items-center justify-center rounded-full bg-brand/12 text-brand">
            <Mail className="size-7" />
          </span>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">Reset link sent</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            If <strong className="font-medium text-ink">{email}</strong> has an account, a password
            reset link is on its way.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Check your spam folder if it hasn&apos;t arrived in a few minutes.
          </p>

          <button
            type="button"
            onClick={() => setSent(false)}
            className="mt-7 text-sm font-medium text-brand hover:underline"
          >
            Use a different address
          </button>

          <p className="mt-6 border-t border-line pt-6 text-sm text-muted">
            <Link href="/login" className="font-medium text-brand hover:underline">
              Back to sign in
            </Link>
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      headline="Forgot your password?"
      subhead="Enter the email on your account and we'll send a link to set a new password."
      highlights={HIGHLIGHTS}
    >
      <h1 className="text-2xl font-semibold tracking-tight">Reset your password</h1>
      <p className="mt-1.5 text-sm text-muted">
        We&apos;ll email you a secure link. Your current password keeps working until you change it.
      </p>

      <form className="mt-7 space-y-4" onSubmit={(e) => void submit(e)}>
        <Field label="Email address">
          <Input
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {error}
          </div>
        )}

        <Button type="submit" className="w-full" size="lg" loading={busy}>
          Send reset link
        </Button>
      </form>

      <p className="mt-7 text-center text-sm text-muted">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 font-medium text-brand hover:underline"
        >
          <ArrowLeft className="size-3.5" />
          Back to sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
