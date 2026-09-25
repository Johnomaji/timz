"use client";

import { AlertCircle, BadgeCheck, Check, Lock } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PageHeading } from "@/components/shell";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  Select,
  statusTone,
  TableShell,
  Td,
  Th,
} from "@/components/ui";
import { useStore } from "@/lib/store";
import { dateTime, money } from "@/lib/utils";

export default function WithdrawPage() {
  const { db, currentUser, requestWithdrawal } = useStore();
  const [amount, setAmount] = useState("");
  const [asset, setAsset] = useState(db.settings.wallets[0]!.asset);
  const [address, setAddress] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  if (!currentUser) return null;

  const verified = currentUser.kycStatus === "verified";
  const myWithdrawals = db.transactions.filter(
    (t) => t.userId === currentUser.id && t.kind === "withdrawal",
  );

  const value = Number(amount) || 0;
  const fee = (value * db.settings.withdrawalFeePct) / 100;
  const total = value + fee;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(false);
    if (!address.trim() || address.trim().length < 12) {
      setError("Enter a valid destination wallet address.");
      return;
    }
    const result = requestWithdrawal(value, `${asset} withdrawal`, address.trim());
    if (!result.ok) {
      setError(result.error ?? "Could not submit that request.");
      return;
    }
    setError("");
    setSubmitted(true);
    setAmount("");
    setAddress("");
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeading
        title="Withdraw funds"
        description="Requests are reviewed by an administrator before funds are released."
      />

      {!verified && (
        <Card className="mb-5 flex flex-wrap items-center justify-between gap-4 border-warn/30 bg-warn/8 p-5">
          <div className="flex items-start gap-3">
            <Lock className="mt-0.5 size-5 shrink-0 text-warn" />
            <div>
              <p className="font-medium text-ink">Withdrawals are locked</p>
              <p className="mt-0.5 text-sm text-muted">
                Complete identity verification to unlock withdrawals on this account.
              </p>
            </div>
          </div>
          <Link href="/dashboard/kyc">
            <Button variant="outline" size="sm">
              <BadgeCheck className="size-4" />
              Verify identity
            </Button>
          </Link>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Card>
          <CardHeader title="Withdrawal request" subtitle="Funds are held while under review" />
          <form className="p-5" onSubmit={submit}>
            <div className="mb-4 flex items-center justify-between rounded-xl border border-line bg-surface-2/50 px-4 py-3">
              <span className="text-sm text-muted">Available balance</span>
              <span className="font-mono font-semibold text-ink">{money(currentUser.balance)}</span>
            </div>

            <div className="space-y-4">
              <Field label="Amount" hint={`Minimum ${money(db.settings.minWithdrawal)}`}>
                <Input
                  type="number"
                  min={db.settings.minWithdrawal}
                  step="0.01"
                  placeholder="500.00"
                  disabled={!verified}
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setError("");
                    setSubmitted(false);
                  }}
                />
              </Field>

              <div className="flex flex-wrap gap-2">
                {[0.25, 0.5, 1].map((fraction) => {
                  const target =
                    Math.floor(
                      (currentUser.balance / (1 + db.settings.withdrawalFeePct / 100)) * fraction * 100,
                    ) / 100;
                  return (
                    <button
                      key={fraction}
                      type="button"
                      disabled={!verified || target <= 0}
                      onClick={() => setAmount(String(target))}
                      className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition-colors hover:border-brand/50 hover:text-brand disabled:opacity-40"
                    >
                      {fraction === 1 ? "Max" : `${fraction * 100}%`}
                    </button>
                  );
                })}
              </div>

              <Field label="Asset">
                <Select value={asset} disabled={!verified} onChange={(e) => setAsset(e.target.value)}>
                  {db.settings.wallets.map((w) => (
                    <option key={w.asset} value={w.asset}>
                      {w.asset} · {w.network}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Destination address" hint="Double-check this — transfers cannot be reversed">
                <Input
                  placeholder="Paste your wallet address"
                  disabled={!verified}
                  value={address}
                  onChange={(e) => {
                    setAddress(e.target.value);
                    setError("");
                  }}
                />
              </Field>
            </div>

            {error && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                {error}
              </div>
            )}

            {submitted && (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-brand/30 bg-brand/10 px-3.5 py-3 text-sm text-brand">
                <Check className="mt-0.5 size-4 shrink-0" />
                Request submitted and funds placed on hold pending approval.
              </div>
            )}

            <Button type="submit" className="mt-5 w-full" size="lg" disabled={!verified}>
              Request withdrawal
            </Button>
          </form>
        </Card>

        <Card className="h-fit">
          <CardHeader title="Summary" />
          <div className="space-y-3 p-5 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Withdrawal amount</span>
              <span className="font-mono text-ink">{money(value)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Processing fee ({db.settings.withdrawalFeePct}%)</span>
              <span className="font-mono text-warn">{money(fee)}</span>
            </div>
            <div className="flex justify-between border-t border-line pt-3">
              <span className="text-muted">Debited from balance</span>
              <span className="font-mono font-semibold text-ink">{money(total)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">You receive</span>
              <span className="font-mono font-semibold text-brand">{money(value)}</span>
            </div>
            <div className="flex justify-between border-t border-line pt-3">
              <span className="text-muted">Balance after</span>
              <span className="font-mono text-ink">
                {money(Math.max(0, currentUser.balance - total))}
              </span>
            </div>
            <p className="pt-2 text-xs text-faint">
              Typical processing time is under 24 hours. You will be notified as soon as an
              administrator releases the payment.
            </p>
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Withdrawal history" subtitle={`${myWithdrawals.length} total`} />
        {myWithdrawals.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">No withdrawals yet.</p>
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th>Reference</Th>
                <Th>Destination</Th>
                <Th className="text-right">Amount</Th>
                <Th>Status</Th>
                <Th>Date</Th>
              </tr>
            </thead>
            <tbody>
              {myWithdrawals.map((tx) => (
                <tr key={tx.id}>
                  <Td className="font-mono text-xs">{tx.reference}</Td>
                  <Td className="max-w-56 truncate text-muted">{tx.note}</Td>
                  <Td className="text-right font-mono">{money(tx.amount)}</Td>
                  <Td>
                    <Badge tone={statusTone(tx.status)}>{tx.status}</Badge>
                  </Td>
                  <Td className="text-muted">{dateTime(tx.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Card>
    </div>
  );
}
