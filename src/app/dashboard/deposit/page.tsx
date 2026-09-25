"use client";

import { AlertCircle, Check, Copy, Info } from "lucide-react";
import { useState } from "react";
import { PageHeading } from "@/components/shell";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  statusTone,
  TableShell,
  Td,
  Th,
} from "@/components/ui";
import { useStore } from "@/lib/store";
import { cn, dateTime, money } from "@/lib/utils";

export default function DepositPage() {
  const { db, currentUser, requestDeposit } = useStore();
  const [walletIndex, setWalletIndex] = useState(0);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!currentUser) return null;

  const wallet = db.settings.wallets[walletIndex]!;
  const myDeposits = db.transactions.filter(
    (t) => t.userId === currentUser.id && t.kind === "deposit",
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(wallet.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Clipboard is unavailable — copy the address manually.");
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value < db.settings.minDeposit) {
      setError(`Minimum deposit is ${money(db.settings.minDeposit)}.`);
      return;
    }
    requestDeposit(value, `${wallet.asset} · ${wallet.network}`);
    setError("");
    setSubmitted(true);
    setAmount("");
  };

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeading
        title="Deposit funds"
        description="Send crypto to your assigned wallet, then tell us the amount so we can match it."
      />

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="1 · Send to this address" subtitle="Choose the asset you are sending" />
          <div className="p-5">
            <div className="flex flex-wrap gap-2">
              {db.settings.wallets.map((w, i) => (
                <button
                  key={w.asset}
                  onClick={() => setWalletIndex(i)}
                  className={cn(
                    "rounded-xl border px-3.5 py-2 text-sm transition-colors",
                    i === walletIndex
                      ? "border-brand/60 bg-brand/10 font-medium text-brand"
                      : "border-line text-muted hover:text-ink",
                  )}
                >
                  {w.asset}
                  <span className="ml-1.5 text-xs opacity-70">{w.network}</span>
                </button>
              ))}
            </div>

            <div className="mt-5 rounded-xl border border-line bg-surface-2/50 p-4">
              <p className="text-xs text-faint">
                {wallet.asset} deposit address · {wallet.network}
              </p>
              <p className="mt-2 font-mono text-sm break-all text-ink">{wallet.address}</p>
              <Button variant="outline" size="sm" className="mt-3.5" onClick={copy}>
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? "Copied" : "Copy address"}
              </Button>
            </div>

            <div className="mt-4 flex gap-2.5 rounded-xl border border-info/25 bg-info/8 p-4 text-sm text-muted">
              <Info className="mt-0.5 size-4 shrink-0 text-info" />
              <p>
                Only send {wallet.asset} on the {wallet.network} network. Deposits on other networks
                cannot be recovered. Minimum {money(db.settings.minDeposit)}.
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="2 · Confirm your transfer"
            subtitle="An administrator credits your balance once the payment clears"
          />
          <form className="p-5" onSubmit={submit}>
            <Field label="Amount sent (USD value)" hint={`Minimum ${money(db.settings.minDeposit)}`}>
              <Input
                type="number"
                min={db.settings.minDeposit}
                step="0.01"
                placeholder="1000.00"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setError("");
                  setSubmitted(false);
                }}
              />
            </Field>

            <div className="mt-4 flex flex-wrap gap-2">
              {[500, 1_000, 5_000, 25_000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAmount(String(preset))}
                  className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition-colors hover:border-brand/50 hover:text-brand"
                >
                  {money(preset, { compact: true })}
                </button>
              ))}
            </div>

            <div className="mt-5 space-y-2 rounded-xl border border-line bg-surface-2/50 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Asset</span>
                <span className="text-ink">
                  {wallet.asset} · {wallet.network}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Deposit fee</span>
                <span className="text-brand">Free</span>
              </div>
              <div className="flex justify-between border-t border-line pt-2">
                <span className="text-muted">Credited after approval</span>
                <span className="font-mono text-ink">{money(Number(amount) || 0)}</span>
              </div>
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
                Deposit submitted. It will appear as pending until an administrator confirms it.
              </div>
            )}

            <Button type="submit" className="mt-5 w-full" size="lg">
              Submit deposit notice
            </Button>
          </form>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Deposit history" subtitle={`${myDeposits.length} total`} />
        {myDeposits.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">No deposits yet.</p>
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th>Reference</Th>
                <Th>Method</Th>
                <Th className="text-right">Amount</Th>
                <Th>Status</Th>
                <Th>Date</Th>
              </tr>
            </thead>
            <tbody>
              {myDeposits.map((tx) => (
                <tr key={tx.id}>
                  <Td className="font-mono text-xs">{tx.reference}</Td>
                  <Td className="text-muted">{tx.method}</Td>
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
