"use client";

import { AlertCircle, Check, TrendingUp, Wallet } from "lucide-react";
import { useState } from "react";
import { PageHeading } from "@/components/shell";
import { Badge, Button, Card, Field, Input, Modal, Progress } from "@/components/ui";
import { useStore, useUserInvestments } from "@/lib/store";
import type { Plan } from "@/lib/types";
import { cn, money, shortDate } from "@/lib/utils";

const accent = {
  brand: { text: "text-brand", border: "hover:border-brand/50", bg: "bg-brand/12" },
  violet: { text: "text-violet", border: "hover:border-violet/50", bg: "bg-violet/12" },
  cyan: { text: "text-cyan", border: "hover:border-cyan/50", bg: "bg-cyan/12" },
  warn: { text: "text-warn", border: "hover:border-warn/50", bg: "bg-warn/12" },
} as const;

export default function PlansPage() {
  const { db, currentUser, invest } = useStore();
  const investments = useUserInvestments(currentUser?.id);
  const [selected, setSelected] = useState<Plan | null>(null);
  const [amount, setAmount] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  if (!currentUser) return null;

  const openPlan = (plan: Plan) => {
    setSelected(plan);
    setAmount(String(plan.minAmount));
    setError("");
    setDone(false);
  };

  const submit = () => {
    if (!selected) return;
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter a valid amount.");
      return;
    }
    const result = invest(selected.id, value);
    if (!result.ok) {
      setError(result.error ?? "Could not complete that investment.");
      return;
    }
    setDone(true);
  };

  const numericAmount = Number(amount) || 0;
  const projectedRoi = selected
    ? (numericAmount * selected.dailyRate * selected.durationDays) / 100
    : 0;

  const active = investments.filter((i) => i.status === "active");

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeading
        title="Investment plans"
        description="Fixed daily rate, principal returned at the end of the term."
        action={
          <div className="rounded-xl border border-line bg-surface px-4 py-2.5">
            <p className="text-xs text-faint">Available to invest</p>
            <p className="font-mono font-semibold text-ink">{money(currentUser.balance)}</p>
          </div>
        }
      />

      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {db.plans
          .filter((p) => p.active)
          .map((plan) => {
            const style = accent[plan.accent];
            const affordable = currentUser.balance >= plan.minAmount;
            const holding = active.filter((i) => i.planId === plan.id);

            return (
              <Card key={plan.id} className={cn("flex flex-col p-6 transition-colors", style.border)}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-ink">{plan.name}</h3>
                    <p className="mt-1 text-sm text-muted">{plan.tagline}</p>
                  </div>
                  <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", style.bg, style.text)}>
                    <TrendingUp className="size-4" />
                  </span>
                </div>

                <div className="mt-5 flex items-end gap-1.5">
                  <span className={cn("font-mono text-4xl font-semibold", style.text)}>
                    {plan.dailyRate}%
                  </span>
                  <span className="pb-1 text-sm text-muted">/ day</span>
                </div>

                <dl className="mt-4 space-y-2 border-t border-line pt-4 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-muted">Term</dt>
                    <dd className="font-mono text-ink">{plan.durationDays} days</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">Total return</dt>
                    <dd className={cn("font-mono font-semibold", style.text)}>
                      {(plan.dailyRate * plan.durationDays).toFixed(0)}%
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">Minimum</dt>
                    <dd className="font-mono text-ink">{money(plan.minAmount, { compact: true })}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-muted">Maximum</dt>
                    <dd className="font-mono text-ink">{money(plan.maxAmount, { compact: true })}</dd>
                  </div>
                </dl>

                <ul className="mt-4 flex-1 space-y-2">
                  {plan.perks.map((perk) => (
                    <li key={perk} className="flex gap-2 text-xs text-muted">
                      <Check className={cn("mt-0.5 size-3.5 shrink-0", style.text)} />
                      {perk}
                    </li>
                  ))}
                </ul>

                {holding.length > 0 && (
                  <Badge tone="success" className="mt-4 w-fit">
                    {holding.length} active · {money(holding.reduce((s, i) => s + i.amount, 0), { compact: true })}
                  </Badge>
                )}

                <Button
                  className="mt-5 w-full"
                  variant={affordable ? "primary" : "outline"}
                  onClick={() => openPlan(plan)}
                >
                  {affordable ? "Invest" : "Needs more balance"}
                </Button>
              </Card>
            );
          })}
      </div>

      {active.length > 0 && (
        <Card className="mt-6">
          <div className="border-b border-line p-5">
            <h3 className="font-semibold text-ink">Your active subscriptions</h3>
          </div>
          <ul className="divide-y divide-line/60">
            {active.map((inv) => (
              <li key={inv.id} className="p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium text-ink">{inv.plan.name}</p>
                    <p className="mt-0.5 text-sm text-muted">
                      {money(inv.amount)} · started {shortDate(inv.startedAt)} · matures{" "}
                      {shortDate(inv.maturesAt)}
                    </p>
                  </div>
                  <p className="font-mono text-sm text-brand">+{money(inv.accrued)} accrued</p>
                </div>
                <Progress value={inv.progress} className="mt-3.5" />
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Modal
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={done ? "Investment activated" : `Invest in ${selected?.name ?? ""}`}
        description={
          done
            ? "Your allocation is live and already accruing daily ROI."
            : selected
              ? `${selected.dailyRate}% daily for ${selected.durationDays} days`
              : undefined
        }
        footer={
          done ? (
            <Button onClick={() => setSelected(null)}>Done</Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => setSelected(null)}>
                Cancel
              </Button>
              <Button onClick={submit}>Confirm investment</Button>
            </>
          )
        }
      >
        {done ? (
          <div className="flex items-center gap-3 rounded-xl border border-brand/30 bg-brand/10 p-4">
            <Check className="size-5 shrink-0 text-brand" />
            <p className="text-sm text-ink">
              {money(numericAmount)} allocated to {selected?.name}. Projected return{" "}
              <span className="font-mono text-brand">{money(projectedRoi)}</span>.
            </p>
          </div>
        ) : (
          selected && (
            <div className="space-y-4">
              <Field
                label="Amount to invest"
                hint={`Range ${money(selected.minAmount)} – ${money(selected.maxAmount)}`}
              >
                <Input
                  type="number"
                  min={selected.minAmount}
                  max={selected.maxAmount}
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setError("");
                  }}
                />
              </Field>

              <div className="flex flex-wrap gap-2">
                {[selected.minAmount, selected.minAmount * 2, Math.min(selected.maxAmount, currentUser.balance)]
                  .filter((v, i, arr) => v > 0 && arr.indexOf(v) === i)
                  .map((preset) => (
                    <button
                      key={preset}
                      onClick={() => setAmount(String(Math.floor(preset)))}
                      className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition-colors hover:border-brand/50 hover:text-brand"
                    >
                      {money(Math.floor(preset), { compact: true })}
                    </button>
                  ))}
              </div>

              <div className="space-y-2 rounded-xl border border-line bg-surface-2/50 p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Daily payout</span>
                  <span className="font-mono text-ink">
                    {money((numericAmount * selected.dailyRate) / 100)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Total ROI at maturity</span>
                  <span className="font-mono font-semibold text-brand">{money(projectedRoi)}</span>
                </div>
                <div className="flex justify-between border-t border-line pt-2">
                  <span className="text-muted">You receive back</span>
                  <span className="font-mono text-ink">{money(numericAmount + projectedRoi)}</span>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl border border-line px-4 py-3 text-sm">
                <span className="flex items-center gap-2 text-muted">
                  <Wallet className="size-4" />
                  Balance after
                </span>
                <span className="font-mono text-ink">
                  {money(Math.max(0, currentUser.balance - numericAmount))}
                </span>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger">
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  {error}
                </div>
              )}
            </div>
          )
        )}
      </Modal>
    </div>
  );
}
