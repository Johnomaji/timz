"use client";

import { AlertTriangle, Plus, RotateCcw, Save, Trash2, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PageHeading } from "@/components/shell";
import { Button, Card, CardHeader, Field, Input, Modal, Toggle } from "@/components/ui";
import { useMoney, useStore } from "@/lib/store";
import type { Settings } from "@/lib/types";

export default function AdminSettingsPage() {
  const router = useRouter();
  const { db, saveSettings, resetDemoData, logout } = useStore();
  const money = useMoney();
  const [form, setForm] = useState<Settings>(db.settings);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);

  const dirty = JSON.stringify(form) !== JSON.stringify(db.settings);

  useEffect(() => {
    if (!saved) return;
    const t = setTimeout(() => setSaved(false), 2500);
    return () => clearTimeout(t);
  }, [saved]);

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const setWallet = (index: number, patch: Partial<Settings["wallets"][number]>) =>
    setForm((prev) => ({
      ...prev,
      wallets: prev.wallets.map((w, i) => (i === index ? { ...w, ...patch } : w)),
    }));

  const submit = () => {
    if (!form.platformName.trim()) {
      setError("The platform needs a name.");
      return;
    }
    if (!form.supportEmail.includes("@")) {
      setError("Enter a valid support email address.");
      return;
    }
    if (form.minDeposit <= 0 || form.minWithdrawal <= 0) {
      setError("Minimums must be greater than zero.");
      return;
    }
    if (form.withdrawalFeePct < 0 || form.withdrawalFeePct > 25) {
      setError("Withdrawal fee must be between 0% and 25%.");
      return;
    }
    if (form.referralCommissionPct < 0 || form.referralCommissionPct > 50) {
      setError("Referral commission must be between 0% and 50%.");
      return;
    }
    if (form.wallets.some((w) => !w.asset.trim() || !w.address.trim())) {
      setError("Every wallet needs an asset and an address.");
      return;
    }
    setError("");
    saveSettings({
      ...form,
      platformName: form.platformName.trim(),
      supportEmail: form.supportEmail.trim(),
      wallets: form.wallets.map((w) => ({
        asset: w.asset.trim().toUpperCase(),
        network: w.network.trim(),
        address: w.address.trim(),
      })),
    });
    setSaved(true);
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeading
        title="Platform settings"
        description="Limits, fees and deposit destinations apply across the whole platform."
        action={
          <div className="flex items-center gap-3">
            {saved && !dirty && <span className="text-sm text-brand">Saved</span>}
            <Button onClick={submit} disabled={!dirty}>
              <Save className="size-4" />
              Save changes
            </Button>
          </div>
        }
      />

      <div className="space-y-5">
        <Card>
          <CardHeader title="Identity" subtitle="Shown to investors across the product and in emails." />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Platform name">
              <Input
                value={form.platformName}
                onChange={(e) => set("platformName", e.target.value)}
              />
            </Field>
            <Field label="Support email">
              <Input
                type="email"
                value={form.supportEmail}
                onChange={(e) => set("supportEmail", e.target.value)}
              />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Limits and fees"
            subtitle="Enforced the moment an investor submits a request."
          />
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Minimum deposit" hint={money(form.minDeposit)}>
              <Input
                type="number"
                min="1"
                value={form.minDeposit}
                onChange={(e) => set("minDeposit", Number(e.target.value))}
              />
            </Field>
            <Field label="Minimum withdrawal" hint={money(form.minWithdrawal)}>
              <Input
                type="number"
                min="1"
                value={form.minWithdrawal}
                onChange={(e) => set("minWithdrawal", Number(e.target.value))}
              />
            </Field>
            <Field
              label="Withdrawal fee (%)"
              hint={`A ${money(1000)} payout costs ${money((1000 * form.withdrawalFeePct) / 100)}`}
            >
              <Input
                type="number"
                step="0.1"
                min="0"
                max="25"
                value={form.withdrawalFeePct}
                onChange={(e) => set("withdrawalFeePct", Number(e.target.value))}
              />
            </Field>
            <Field
              label="Referral reward (%)"
              hint="Share of a referral's ROI, paid when their plan matures"
            >
              <Input
                type="number"
                step="0.5"
                min="0"
                max="50"
                value={form.referralCommissionPct}
                onChange={(e) => set("referralCommissionPct", Number(e.target.value))}
              />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader title="Access" subtitle="Control who can reach the platform right now." />
          <div className="divide-y divide-line px-5">
            <Toggle
              label="Signups open"
              description="Turn off to stop new investor registrations without touching existing accounts"
              checked={form.signupsOpen}
              onChange={(next) => set("signupsOpen", next)}
            />
            <Toggle
              label="Maintenance mode"
              description="Investors see a maintenance notice; the admin console stays reachable"
              checked={form.maintenanceMode}
              onChange={(next) => set("maintenanceMode", next)}
            />
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Deposit wallets"
            subtitle="Investors copy these addresses on the deposit screen."
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    wallets: [...prev.wallets, { asset: "", network: "", address: "" }],
                  }))
                }
              >
                <Plus className="size-4" />
                Add wallet
              </Button>
            }
          />
          <div className="space-y-4 p-5">
            {form.wallets.length === 0 && (
              <p className="rounded-xl border border-warn/30 bg-warn/8 px-4 py-3 text-sm text-muted">
                No wallets configured — investors cannot make a deposit until you add one.
              </p>
            )}
            {form.wallets.map((wallet, index) => (
              <div
                key={index}
                className="rounded-xl border border-line bg-surface-2/40 p-4"
              >
                <div className="mb-3 flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-medium text-ink">
                    <Wallet className="size-4 text-brand" />
                    {wallet.asset.trim() || `Wallet ${index + 1}`}
                  </span>
                  <button
                    aria-label={`Remove wallet ${index + 1}`}
                    onClick={() =>
                      setForm((prev) => ({
                        ...prev,
                        wallets: prev.wallets.filter((_, i) => i !== index),
                      }))
                    }
                    className="rounded-lg border border-line p-1.5 text-muted transition-colors hover:border-danger/50 hover:text-danger"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                <div className="grid gap-3 sm:grid-cols-4">
                  <Field label="Asset">
                    <Input
                      placeholder="USDT"
                      value={wallet.asset}
                      onChange={(e) => setWallet(index, { asset: e.target.value })}
                    />
                  </Field>
                  <Field label="Network">
                    <Input
                      placeholder="TRC20"
                      value={wallet.network}
                      onChange={(e) => setWallet(index, { network: e.target.value })}
                    />
                  </Field>
                  <Field label="Address" className="sm:col-span-2">
                    <Input
                      className="font-mono text-xs"
                      placeholder="Wallet address investors send to"
                      value={wallet.address}
                      onChange={(e) => setWallet(index, { address: e.target.value })}
                    />
                  </Field>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {error && (
          <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-4 rounded-xl2 border border-line bg-surface/80 p-5">
          <div className="min-w-0">
            <p className="font-medium text-ink">
              {dirty ? "You have unsaved changes" : "Everything is saved"}
            </p>
            <p className="mt-1 text-sm text-muted">
              Changes apply to new deposits, withdrawals and investments immediately.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button variant="ghost" onClick={() => setForm(db.settings)} disabled={!dirty}>
              Discard
            </Button>
            <Button onClick={submit} disabled={!dirty}>
              <Save className="size-4" />
              Save changes
            </Button>
          </div>
        </div>

        <Card className="border-danger/30">
          <CardHeader
            title={
              <span className="flex items-center gap-2 text-danger">
                <AlertTriangle className="size-4" />
                Danger zone
              </span>
            }
            subtitle="Wipe every account, plan, transaction and setting back to the seeded demo state."
          />
          <div className="flex items-center justify-between gap-4 p-5">
            <p className="text-sm text-muted">
              This affects all {db.users.length} accounts and cannot be undone. You will be signed
              out.
            </p>
            <Button variant="danger" onClick={() => setConfirmReset(true)}>
              <RotateCcw className="size-4" />
              Reset demo data
            </Button>
          </div>
        </Card>
      </div>

      <Modal
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset all demo data?"
        description="Every account, investment, transaction and setting returns to its seeded state."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                logout();
                resetDemoData();
                router.replace("/login");
              }}
            >
              Reset and sign out
            </Button>
          </>
        }
      >
        <p className="rounded-xl border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-muted">
          Sign back in with <span className="font-mono text-ink">admin@apexvest.io</span> /{" "}
          <span className="font-mono text-ink">admin123</span> afterwards.
        </p>
      </Modal>
    </div>
  );
}
