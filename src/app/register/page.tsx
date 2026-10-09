"use client";

import {
  AlertCircle,
  Check,
  Eye,
  EyeOff,
  Headphones,
  Lock,
  Mail,
  ShieldCheck,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthLayout } from "@/components/auth-layout";
import { Button, Field, Input } from "@/components/ui";
import { useStore } from "@/lib/store";
import { signUp } from "@/lib/supabase/auth";
import { usingSupabase } from "@/lib/supabase/config";

const HIGHLIGHTS = [
  { icon: TrendingUp, label: "Fixed-term plans with a target return" },
  { icon: ShieldCheck, label: "Verified accounts, transparent payouts" },
  { icon: Headphones, label: "24/7 support" },
];

export default function RegisterPage() {
  const { register } = useStore();
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
    referralCode: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (form.password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    const input = {
      name: form.name,
      email: form.email,
      password: form.password,
      referralCode: form.referralCode || undefined,
    };
    const result = usingSupabase ? await signUp(input) : register(input);

    if (!result.ok) {
      setError(result.error ?? "Unable to create your account.");
      setBusy(false);
      return;
    }
    if ("needsEmailConfirmation" in result && result.needsEmailConfirmation) {
      setPendingEmail(form.email);
      setBusy(false);
      return;
    }
    router.replace("/verify");
  };

  if (pendingEmail) {
    return (
      <AuthLayout
        headline="One click away."
        subhead="Confirm your email address to activate your account and start verification."
        highlights={HIGHLIGHTS}
      >
        <div className="text-center">
          <span className="animate-ring mx-auto flex size-16 items-center justify-center rounded-full bg-brand/12 text-brand">
            <Mail className="size-7" />
          </span>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight">Check your email</h1>
          <p className="mt-3 text-sm leading-relaxed text-muted">
            We sent a verification link to{" "}
            <strong className="font-medium text-ink">{pendingEmail}</strong>.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Click the link in your inbox to verify your account. If you don&apos;t see it, check
            your spam folder.
          </p>

          <button
            type="button"
            onClick={() => setPendingEmail("")}
            className="mt-7 text-sm font-medium text-brand hover:underline"
          >
            Change email address
          </button>

          <p className="mt-6 border-t border-line pt-6 text-sm text-muted">
            Already confirmed?{" "}
            <Link href="/login" className="font-medium text-brand hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </AuthLayout>
    );
  }

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
      <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
      <p className="mt-1.5 text-sm text-muted">Start your journey in just a few minutes.</p>

      <form className="mt-7 space-y-4" onSubmit={(e) => void submit(e)}>
        <Field label="Full name">
          <Input
            required
            autoComplete="name"
            placeholder="Jane Doe"
            value={form.name}
            onChange={(e) => set("name")(e.target.value)}
          />
        </Field>

        <Field label="Email address">
          <Input
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={form.email}
            onChange={(e) => set("email")(e.target.value)}
          />
        </Field>

        <Field label="Password" hint="At least 6 characters">
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              required
              autoComplete="new-password"
              className="pr-11"
              placeholder="Create a strong password"
              value={form.password}
              onChange={(e) => set("password")(e.target.value)}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="absolute top-1/2 right-3 -translate-y-1/2 text-faint transition-colors hover:text-muted"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </Field>

        <Field label="Confirm password">
          <Input
            type="password"
            required
            autoComplete="new-password"
            placeholder="••••••••"
            value={form.confirm}
            onChange={(e) => set("confirm")(e.target.value)}
          />
        </Field>

        <Field label="Referral code" hint="Optional — try VEST-JW4Q">
          <Input
            placeholder="VEST-XXXX"
            value={form.referralCode}
            onChange={(e) => set("referralCode")(e.target.value.toUpperCase())}
          />
        </Field>

        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            {error}
          </div>
        )}

        <Button type="submit" className="w-full" size="lg" loading={busy}>
          Create account
        </Button>
      </form>

      <ul className="mt-6 grid gap-2">
        {["Free to open", "No minimum to get started", "Cancel any time before you invest"].map(
          (benefit) => (
            <li key={benefit} className="flex items-center gap-2 text-xs text-muted">
              <Check className="size-3.5 shrink-0 text-brand" />
              {benefit}
            </li>
          ),
        )}
      </ul>

      <p className="mt-7 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand hover:underline">
          Log in
        </Link>
      </p>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-faint">
        <Lock className="size-3" />
        Your information is encrypted and secure
      </p>
    </AuthLayout>
  );
}
