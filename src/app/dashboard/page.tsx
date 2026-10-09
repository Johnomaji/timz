"use client";

import {
  ArrowDownToLine,
  ArrowRight,
  Clock,
  Coins,
  PiggyBank,
  ShieldCheck,
  Timer,
  TrendingUp,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { AllocationDonut, EarningsChart, StatCard } from "@/components/charts";
import { PageHeading } from "@/components/shell";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Progress,
  statusTone,
} from "@/components/ui";
import { useMoney, useStore, useUserInvestments } from "@/lib/store";
import type { KycStatus } from "@/lib/types";
import { cn, dayKey, emptyDayBuckets, shortDate, timeAgo } from "@/lib/utils";

/** Nudge only — verification is optional, so this never blocks the dashboard. */
function KycBanner({ status }: { status: KycStatus }) {
  if (status === "approved") return null;

  const pending = status === "pending";
  const declined = status === "declined";

  return (
    <div
      className={cn(
        "mb-5 flex flex-wrap items-center gap-4 rounded-xl2 border px-5 py-4",
        pending && "border-warn/30 bg-warn/10",
        declined && "border-danger/30 bg-danger/10",
        !pending && !declined && "border-brand/30 bg-brand/10",
      )}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-xl",
          pending && "bg-warn/15 text-warn",
          declined && "bg-danger/15 text-danger",
          !pending && !declined && "bg-brand/15 text-brand",
        )}
      >
        {pending ? <Clock className="size-5" /> : <ShieldCheck className="size-5" />}
      </span>

      <div className="min-w-0 flex-1">
        <p className="font-medium text-ink">
          {pending
            ? "Verification in review"
            : declined
              ? "Verification unsuccessful"
              : "Verify your identity"}
        </p>
        <p className="mt-0.5 text-sm text-muted">
          {pending
            ? "We'll email you as soon as our partner reaches a decision."
            : declined
              ? "We couldn't confirm your documents. You can submit again at any time."
              : "A two-minute check secures your account. You can keep investing in the meantime."}
        </p>
      </div>

      {!pending && (
        <Link href="/verify">
          <Button variant={declined ? "outline" : "primary"} size="sm">
            {declined ? "Try again" : "Verify now"}
            <ArrowRight className="size-3.5" />
          </Button>
        </Link>
      )}
    </div>
  );
}

export default function DashboardOverview() {
  const { db, currentUser, collectInvestment } = useStore();
  const money = useMoney();
  const investments = useUserInvestments(currentUser?.id);
  const [collecting, setCollecting] = useState(false);
  const [collectError, setCollectError] = useState("");

  // Sequential rather than parallel: each collection locks the row, credits the balance and
  // reloads the store, so overlapping calls would fight over the same refresh.
  const collect = async (ids: string[]) => {
    if (collecting) return;
    setCollecting(true);
    setCollectError("");
    for (const id of ids) {
      const result = await collectInvestment(id);
      if (!result.ok) {
        setCollectError(result.error ?? "Could not collect that plan.");
        break;
      }
    }
    setCollecting(false);
  };

  const myTransactions = useMemo(
    () => db.transactions.filter((t) => t.userId === currentUser?.id),
    [db.transactions, currentUser?.id],
  );

  const active = investments.filter((i) => i.status === "active");
  const totalInvested = active.reduce((sum, i) => sum + i.amount, 0);
  const accruedRoi = active.reduce((sum, i) => sum + i.accrued, 0);
  const lifetimeEarnings = myTransactions
    .filter((t) => t.kind === "earning" && t.status === "completed")
    .reduce((sum, t) => sum + t.amount, 0);
  const referralEarnings = myTransactions
    .filter((t) => t.kind === "referral")
    .reduce((sum, t) => sum + t.amount, 0);
  const matured = active.filter((i) => i.matured);

  const earningsSeries = useMemo(() => {
    const buckets = emptyDayBuckets(14, "day");
    myTransactions
      .filter((t) => t.kind === "earning" || t.kind === "referral")
      .forEach((t) => {
        const key = dayKey(new Date(t.createdAt), "day");
        if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + t.amount);
      });
    return [...buckets].map(([label, value]) => ({ label, value: Math.round(value * 100) / 100 }));
  }, [myTransactions]);

  const byPlan = new Map<string, number>();
  active.forEach((i) => byPlan.set(i.plan.name, (byPlan.get(i.plan.name) ?? 0) + i.amount));
  const allocation = [...byPlan].map(([name, value]) => ({ name, value }));

  if (!currentUser) return null;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeading
        title="Portfolio overview"
        description={[`Last active ${timeAgo(currentUser.lastActiveAt)}`, currentUser.country]
          .filter(Boolean)
          .join(" · ")}
        action={
          <div className="flex gap-2">
            <Link href="/dashboard/deposit">
              <Button variant="outline">
                <ArrowDownToLine className="size-4" />
                Deposit
              </Button>
            </Link>
            <Link href="/dashboard/plans">
              <Button>
                Invest now
                <ArrowRight className="size-4" />
              </Button>
            </Link>
          </div>
        }
      />

      <KycBanner status={currentUser.kycStatus} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Available balance"
          value={money(currentUser.balance)}
          sub="Withdrawable or ready to invest"
          icon={Wallet}
        />
        <StatCard
          label="Active capital"
          value={money(totalInvested)}
          sub={`${active.length} active ${active.length === 1 ? "plan" : "plans"}`}
          icon={PiggyBank}
          tone="violet"
        />
        <StatCard
          label="Accruing ROI"
          value={money(accruedRoi)}
          sub="Unlocked at plan maturity"
          icon={TrendingUp}
          tone="cyan"
        />
        <StatCard
          label="Lifetime earnings"
          value={money(lifetimeEarnings + referralEarnings)}
          sub={`Includes ${money(referralEarnings)} referral`}
          icon={Coins}
          tone="warn"
        />
      </div>

      {matured.length > 0 && (
        <Card className="mt-6 border-brand/30 bg-brand/8 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Timer className="mt-0.5 size-5 shrink-0 text-brand" />
              <div>
                <p className="font-medium text-ink">
                  {matured.length} {matured.length === 1 ? "plan has" : "plans have"} matured
                </p>
                <p className="mt-0.5 text-sm text-muted">
                  {collectError ||
                    `Collect ${money(
                      matured.reduce((sum, i) => sum + i.amount + i.projectedTotal, 0),
                    )} of principal plus ROI into your balance.`}
                </p>
              </div>
            </div>
            <Button onClick={() => collect(matured.map((i) => i.id))} disabled={collecting}>
              {collecting ? "Collecting…" : "Collect all"}
            </Button>
          </div>
        </Card>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader
            title="Earnings — last 14 days"
            subtitle="ROI accrual and referral commission"
          />
          <div className="p-5">
            <EarningsChart data={earningsSeries} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Allocation by plan" subtitle="Capital currently deployed" />
          <div className="p-5">
            {allocation.length > 0 ? (
              <AllocationDonut data={allocation} />
            ) : (
              <EmptyState
                icon={<PiggyBank className="size-5" />}
                title="Nothing allocated yet"
                description="Subscribe to a plan to start earning."
                action={
                  <Link href="/dashboard/plans">
                    <Button size="sm">Browse plans</Button>
                  </Link>
                }
              />
            )}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader
            title="Active investments"
            subtitle="Progress toward maturity"
            action={
              <Link href="/dashboard/plans">
                <Button variant="ghost" size="sm">
                  Add plan
                </Button>
              </Link>
            }
          />
          {active.length === 0 ? (
            <EmptyState
              icon={<TrendingUp className="size-5" />}
              title="No active investments"
              description="Pick a plan that matches your horizon and lock in your rate."
              action={
                <Link href="/dashboard/plans">
                  <Button size="sm">View plans</Button>
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-line/60">
              {active.map((inv) => (
                <li key={inv.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-ink">{inv.plan.name}</p>
                        <Badge tone={inv.matured ? "success" : "info"}>
                          {inv.matured ? "Matured" : `${inv.daysRemaining}d left`}
                        </Badge>
                      </div>
                      <p className="mt-1 text-sm text-muted">
                        {money(inv.amount)} locked at {inv.roiPct}% · matures{" "}
                        {shortDate(inv.maturesAt)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-semibold text-brand">+{money(inv.accrued)}</p>
                      <p className="text-xs text-faint">of {money(inv.projectedTotal)} projected</p>
                    </div>
                  </div>

                  <Progress value={inv.progress} className="mt-4" />

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <span className="text-xs text-faint">
                      Day {Math.floor(inv.elapsedDays)} of {inv.plan.durationDays}
                    </span>
                    {inv.matured && (
                      <Button size="sm" onClick={() => collect([inv.id])} disabled={collecting}>
                        Collect {money(inv.amount + inv.projectedTotal)}
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Recent activity"
            action={
              <Link href="/dashboard/transactions">
                <Button variant="ghost" size="sm">
                  View all
                </Button>
              </Link>
            }
          />
          {myTransactions.length === 0 ? (
            <EmptyState title="No transactions yet" />
          ) : (
            <ul className="divide-y divide-line/60">
              {myTransactions.slice(0, 7).map((tx) => (
                <li key={tx.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink capitalize">{tx.kind}</p>
                    <p className="truncate text-xs text-faint">
                      {tx.method} · {timeAgo(tx.createdAt)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p
                      className={`font-mono text-sm ${
                        tx.kind === "withdrawal" || tx.kind === "investment"
                          ? "text-muted"
                          : "text-brand"
                      }`}
                    >
                      {tx.kind === "withdrawal" || tx.kind === "investment" ? "−" : "+"}
                      {money(tx.amount)}
                    </p>
                    <Badge tone={statusTone(tx.status)} className="mt-1">
                      {tx.status}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
