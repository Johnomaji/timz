"use client";

import { AlertCircle, ArrowLeft, Check, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Card, Field, Input, Select } from "@/components/ui";
import { useStore } from "@/lib/store";

const COUNTRIES = [
  "United Kingdom",
  "United States",
  "Nigeria",
  "Germany",
  "India",
  "Singapore",
  "Canada",
  "Australia",
  "South Africa",
  "Brazil",
];

const BENEFITS = [
  "Your ROI rate locked in on every plan",
  "Referral commission on invited investors",
  "Full transaction history and payout tracking",
];

export default function RegisterPage() {
  const { register, db } = useStore();
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
    country: COUNTRIES[0]!,
    referralCode: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const submit = (e: React.FormEvent) => {
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
    const result = register({
      name: form.name,
      email: form.email,
      password: form.password,
      country: form.country,
      referralCode: form.referralCode || undefined,
    });

    if (!result.ok) {
      setError(result.error ?? "Unable to create your account.");
      setBusy(false);
      return;
    }
    router.replace("/dashboard");
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

      <Card className="animate-rise w-full max-w-lg p-7">
        <span className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-cyan text-brand-ink">
          <Wallet className="size-5" strokeWidth={2.5} />
        </span>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">Open your account</h1>
        <p className="mt-1.5 text-sm text-muted">
          Free to create. Verification is only needed before your first withdrawal.
        </p>

        <ul className="mt-5 space-y-2">
          {BENEFITS.map((benefit) => (
            <li key={benefit} className="flex items-center gap-2 text-sm text-muted">
              <Check className="size-4 shrink-0 text-brand" />
              {benefit}
            </li>
          ))}
        </ul>

        <form className="mt-7 space-y-4" onSubmit={submit}>
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

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Password" hint="At least 6 characters">
              <Input
                type="password"
                required
                autoComplete="new-password"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => set("password")(e.target.value)}
              />
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
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Country">
              <Select value={form.country} onChange={(e) => set("country")(e.target.value)}>
                {COUNTRIES.map((country) => (
                  <option key={country} value={country}>
                    {country}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Referral code" hint="Optional — try APEX-JW4Q">
              <Input
                placeholder="APEX-XXXX"
                value={form.referralCode}
                onChange={(e) => set("referralCode")(e.target.value.toUpperCase())}
              />
            </Field>
          </div>

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

        <p className="mt-6 text-center text-sm text-muted">
          Already registered?{" "}
          <Link href="/login" className="font-medium text-brand hover:underline">
            Sign in
          </Link>
        </p>
      </Card>
    </div>
  );
}
