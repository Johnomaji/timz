"use client";

import { AlertCircle, Headphones, KeyRound, Loader2, ShieldCheck, TrendingUp } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AuthLayout } from "@/components/auth-layout";
import { Button, Field, PasswordInput } from "@/components/ui";
import { completePasswordReset } from "@/lib/supabase/auth";
import { getBrowserClient } from "@/lib/supabase/client";
import { usingSupabase } from "@/lib/supabase/config";

const HIGHLIGHTS = [
  { icon: TrendingUp, label: "Fixed-term plans with a target return" },
  { icon: ShieldCheck, label: "Verified accounts, transparent payouts" },
  { icon: Headphones, label: "24/7 support" },
];

export default function ResetPasswordPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"checking" | "ready" | "expired">("checking");
  const [form, setForm] = useState({ password: "", confirm: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // /auth/confirm has already traded the emailed token for a session by the time this
  // renders, so the presence of a user is what tells us the link was good.
  useEffect(() => {
    if (!usingSupabase) {
      setStatus("expired");
      return;
    }
    void (async () => {
      const { data } = await getBrowserClient().auth.getUser();
      setStatus(data.user ? "ready" : "expired");
    })();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    const result = await completePasswordReset(form.password);
    if (!result.ok) {
      setError(result.error ?? "Could not update your password.");
      setBusy(false);
      return;
    }
    router.replace(result.user?.role === "admin" ? "/admin" : "/dashboard");
  };

  if (status === "checking") {
    return (
      <AuthLayout headline="One moment." subhead="Checking your reset link." highlights={HIGHLIGHTS}>
        <div className="flex items-center justify-center gap-2.5 py-10 text-sm text-muted">
          <Loader2 className="size-4 animate-spin" />
          Verifying your link
        </div>
      </AuthLayout>
    );
  }

  if (status === "expired") {
    return (
      <AuthLayout
        headline="That link has expired."
        subhead="Reset links are single-use and time-limited. Request a fresh one."
        highlights={HIGHLIGHTS}
      >
        <div className="text-center">
          <span className="mx-auto flex size-16 items-center justify-center rounded-full bg-danger/12 text-danger">
            <AlertCircle className="size-7" />
          </span>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">Link no longer valid</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            It may have expired, already been used, or been opened after a newer link was
            requested.
          </p>

          <Button
            className="mt-7 w-full"
            size="lg"
            onClick={() => router.push("/forgot-password")}
          >
            Request a new link
          </Button>

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
      headline="Set a new password."
      subhead="Choose something you haven't used elsewhere. You'll be signed in straight after."
      highlights={HIGHLIGHTS}
    >
      <span className="flex size-12 items-center justify-center rounded-xl bg-brand/12 text-brand">
        <KeyRound className="size-5" />
      </span>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">Choose a new password</h1>
      <p className="mt-1.5 text-sm text-muted">
        This replaces your old password everywhere and signs you in.
      </p>

      <form className="mt-7 space-y-4" onSubmit={(e) => void submit(e)}>
        <Field label="New password" hint="At least 6 characters">
          <PasswordInput
            required
            autoComplete="new-password"
            placeholder="Create a strong password"
            value={form.password}
            onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))}
          />
        </Field>

        <Field label="Confirm new password">
          <PasswordInput
            required
            autoComplete="new-password"
            placeholder="••••••••"
            value={form.confirm}
            onChange={(e) => setForm((prev) => ({ ...prev, confirm: e.target.value }))}
          />
        </Field>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {error}
          </div>
        )}

        <Button type="submit" className="w-full" size="lg" loading={busy}>
          Update password
        </Button>
      </form>
    </AuthLayout>
  );
}
