"use client";

import { AlertCircle, ArrowLeft, ShieldCheck, User, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Field, Input } from "@/components/ui";
import { DEMO_ADMIN, DEMO_USER } from "@/lib/seed";
import { useStore } from "@/lib/store";

export default function LoginPage() {
  const { login, db } = useStore();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = (nextEmail: string, nextPassword: string) => {
    setError("");
    setBusy(true);
    const result = login(nextEmail, nextPassword);
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
    submit(creds.email, creds.password);
  };

  return (
    <div className="glow-grid flex min-h-screen flex-col items-center justify-center px-5 py-12">
      <Link
        href="/"
        className="mb-8 flex items-center gap-2 text-sm text-muted transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        Back to {db.settings.platformName}
      </Link>

      <Card className="animate-rise w-full max-w-md p-7">
        <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-cyan text-brand-ink">
          <Wallet className="size-5" strokeWidth={2.5} />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">Sign in to your account</h1>
        <p className="mt-1.5 text-sm text-muted">
          Enter your credentials, or jump straight in with a demo account.
        </p>

        <form
          className="mt-7 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            submit(email, password);
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

        <p className="mt-6 text-center text-sm text-muted">
          No account yet?{" "}
          <Link href="/register" className="font-medium text-brand hover:underline">
            Open one free
          </Link>
        </p>
      </Card>
    </div>
  );
}
