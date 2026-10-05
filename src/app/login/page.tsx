"use client";

import { AlertCircle, LineChart, Lock, ShieldCheck, User, Headphones } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthLayout } from "@/components/auth-layout";
import { Button, Field, Input } from "@/components/ui";
import { DEMO_ADMIN, DEMO_USER } from "@/lib/seed";
import { useStore } from "@/lib/store";
import { signIn } from "@/lib/supabase/auth";
import { usingSupabase } from "@/lib/supabase/config";

const HIGHLIGHTS = [
  { icon: LineChart, label: "Fixed-term plans with a target return" },
  { icon: ShieldCheck, label: "Verified accounts, transparent payouts" },
  { icon: Headphones, label: "24/7 support" },
];

export default function LoginPage() {
  const { login } = useStore();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (nextEmail: string, nextPassword: string) => {
    setError("");
    setBusy(true);
    const result = usingSupabase
      ? await signIn(nextEmail, nextPassword)
      : login(nextEmail, nextPassword);
    if (!result.ok) {
      setError(result.error ?? "Unable to sign in.");
      setBusy(false);
      return;
    }
    router.replace(result.user?.role === "admin" ? "/admin" : "/dashboard");
  };

  const fill = (creds: { email: string; password: string }) => {
    setEmail(creds.email);
    setPassword(creds.password);
    void submit(creds.email, creds.password);
  };

  return (
    <AuthLayout
      headline={
        <>
          Grow your capital.
          <br />
          Secure your future.
        </>
      }
      subhead="Lock in a term, track your position daily, and withdraw on maturity. Built for a more transparent way to invest."
      highlights={HIGHLIGHTS}
    >
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-1.5 text-sm text-muted">
        Sign in to your account, or jump straight in with a demo profile.
      </p>

      <form
        className="mt-7 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void submit(email, password);
        }}
      >
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

        <Field label="Password">
          <Input
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {error}
          </div>
        )}

        <Button type="submit" className="w-full" size="lg" loading={busy}>
          Sign in
        </Button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs text-faint">
        <span className="h-px flex-1 bg-line" />
        OR USE A DEMO ACCOUNT
        <span className="h-px flex-1 bg-line" />
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => fill(DEMO_USER)}
          className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/50 px-3.5 py-3 text-left transition-colors hover:border-brand/50"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-brand/12 text-brand">
            <User className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium text-ink">Investor</span>
            <span className="block truncate text-xs text-faint">{DEMO_USER.email}</span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => fill(DEMO_ADMIN)}
          className="flex items-center gap-3 rounded-xl border border-line bg-surface-2/50 px-3.5 py-3 text-left transition-colors hover:border-violet/50"
        >
          <span className="flex size-8 items-center justify-center rounded-lg bg-violet/12 text-violet">
            <ShieldCheck className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium text-ink">Admin</span>
            <span className="block truncate text-xs text-faint">{DEMO_ADMIN.email}</span>
          </span>
        </button>
      </div>

      <p className="mt-7 text-center text-sm text-muted">
        No account yet?{" "}
        <Link href="/register" className="font-medium text-brand hover:underline">
          Open one free
        </Link>
      </p>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-faint">
        <Lock className="size-3" />
        Your connection is encrypted
      </p>
    </AuthLayout>
  );
}
