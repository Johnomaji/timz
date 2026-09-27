"use client";

import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Banknote,
  PiggyBank,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { AllocationDonut, StatCard, VolumeChart } from "@/components/charts";
import { PageHeading } from "@/components/shell";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  statusTone,
  TableShell,
  Td,
  Th,
} from "@/components/ui";
import { buildInvestmentView, useStore, type InvestmentView } from "@/lib/store";
import { dayKey, emptyDayBuckets, money, timeAgo } from "@/lib/utils";

export default function AdminOverview() {
  const { db } = useStore();

  const investors = db.users.filter((u) => u.role === "user");
  const pendingDeposits = db.transactions.filter((t) => t.kind === "deposit" && t.status === "pending");
  const pendingWithdrawals = db.transactions.filter(
    (t) => t.kind === "withdrawal" && t.status === "pending",
  );

  const activeInvestments = useMemo(
    () =>
      db.investments
        .map((i) => buildInvestmentView(i, db.plans))
        .filter((i): i is InvestmentView => i !== null && i.status === "active"),
    [db.investments, db.plans],
  );

  const capitalDeployed = activeInvestments.reduce((sum, i) => sum + i.amount, 0);
  const liability = activeInvestments.reduce((sum, i) => sum + i.amount + i.accrued, 0);
  const totalBalances = investors.reduce((sum, u) => sum + u.balance, 0);

  const approvedDeposits = db.transactions
    .filter((t) => t.kind === "deposit" && t.status === "approved")
    .reduce((sum, t) => sum + t.amount, 0);
  const paidWithdrawals = db.transactions
    .filter((t) => t.kind === "withdrawal" && t.status === "approved")
    .reduce((sum, t) => sum + t.amount, 0);

  const volumeSeries = useMemo(() => {
    const buckets = emptyDayBuckets(7, "weekday");
    db.transactions
      .filter((t) => t.kind === "deposit" && t.status !== "rejected")
      .forEach((t) => {
        const key = dayKey(new Date(t.createdAt), "weekday");
        if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + t.amount);
      });
    return [...buckets].map(([label, value]) => ({ label, value }));
  }, [db.transactions]);

  const planAllocation = useMemo(() => {
    const byPlan = new Map<string, number>();
    activeInvestments.forEach((i) =>
      byPlan.set(i.plan.name, (byPlan.get(i.plan.name) ?? 0) + i.amount),
    );
    return [...byPlan].map(([name, value]) => ({ name, value }));
  }, [activeInvestments]);

  const queue = [
    {
      href: "/admin/deposits" as const,
      label: "Deposits awaiting approval",
      count: pendingDeposits.length,
      value: pendingDeposits.reduce((s, t) => s + t.amount, 0),
      icon: ArrowDownToLine,
    },
    {
      href: "/admin/withdrawals" as const,
      label: "Withdrawals awaiting release",
      count: pendingWithdrawals.length,
      value: pendingWithdrawals.reduce((s, t) => s + t.amount, 0),
      icon: ArrowUpFromLine,
    },
  ];

  const recent = db.transactions.slice(0, 8);

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeading
        title="Platform overview"
        description="Liquidity, queues and investor activity across the whole platform."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Investors"
          value={String(investors.length)}
          sub={`${investors.filter((u) => u.status === "active").length} active`}
          icon={Users}
        />
        <StatCard
          label="Capital deployed"
          value={money(capitalDeployed, { compact: true })}
          sub={`${activeInvestments.length} active plans`}
          icon={PiggyBank}
          tone="violet"
        />
        <StatCard
          label="Investor balances"
          value={money(totalBalances, { compact: true })}
          sub="Withdrawable on demand"
          icon={Banknote}
          tone="cyan"
        />
        <StatCard
          label="Total liability"
          value={money(liability + totalBalances, { compact: true })}
          sub="Balances plus principal and accrued ROI"
          icon={TrendingUp}
          tone="warn"
        />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        {queue.map((item) => (
          <Link key={item.href} href={item.href}>
            <Card
              className={`h-full p-5 transition-colors ${
                item.count > 0 ? "border-warn/30 hover:border-warn/60" : "hover:border-line"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm text-muted">{item.label}</p>
                  <p className="mt-2 font-mono text-2xl font-semibold text-ink">{item.count}</p>
                  {item.value !== null && item.count > 0 && (
                    <p className="mt-1 text-xs text-faint">{money(item.value)} in value</p>
                  )}
                </div>
                <span
                  className={`flex size-8 items-center justify-center rounded-lg ${
                    item.count > 0 ? "bg-warn/12 text-warn" : "bg-surface-2 text-faint"
                  }`}
                >
                  <item.icon className="size-4" />
                </span>
              </div>
              {item.count > 0 && (
                <Badge tone="warning" className="mt-3">
                  Needs attention
                </Badge>
              )}
            </Card>
          </Link>
        ))}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader
            title="Deposit volume — last 7 days"
            subtitle={`${money(approvedDeposits, { compact: true })} approved all-time · ${money(paidWithdrawals, { compact: true })} paid out`}
          />
          <div className="p-5">
            <VolumeChart data={volumeSeries} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Capital by plan" subtitle="Active allocations only" />
          <div className="p-5">
            {planAllocation.length > 0 ? (
              <AllocationDonut data={planAllocation} />
            ) : (
              <EmptyState title="No active allocations" />
            )}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader
            title="Latest platform activity"
            action={
              <Link href="/admin/deposits">
                <Button variant="ghost" size="sm">
                  Open queues
                </Button>
              </Link>
            }
          />
          <TableShell>
            <thead>
              <tr>
                <Th>Investor</Th>
                <Th>Type</Th>
                <Th className="text-right">Amount</Th>
                <Th>Status</Th>
                <Th>When</Th>
              </tr>
            </thead>
            <tbody>
              {recent.map((tx) => {
                const user = db.users.find((u) => u.id === tx.userId);
                return (
                  <tr key={tx.id}>
                    <Td>
                      <span className="flex items-center gap-2.5">
                        {user && <Avatar name={user.name} hue={user.avatarHue} size={28} />}
                        <span className="truncate">{user?.name ?? "Unknown"}</span>
                      </span>
                    </Td>
                    <Td className="capitalize">{tx.kind}</Td>
                    <Td className="text-right font-mono">{money(tx.amount)}</Td>
                    <Td>
                      <Badge tone={statusTone(tx.status)}>{tx.status}</Badge>
                    </Td>
                    <Td className="whitespace-nowrap text-muted">{timeAgo(tx.createdAt)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </TableShell>
        </Card>

        <Card>
          <CardHeader
            title="Top investors"
            subtitle="By active capital"
            action={
              <Link href="/admin/users">
                <Button variant="ghost" size="sm">
                  All users
                </Button>
              </Link>
            }
          />
          <ul className="divide-y divide-line/60">
            {investors
              .map((user) => ({
                user,
                deployed: activeInvestments
                  .filter((i) => i.userId === user.id)
                  .reduce((sum, i) => sum + i.amount, 0),
              }))
              .sort((a, b) => b.deployed - a.deployed)
              .slice(0, 6)
              .map(({ user, deployed }) => (
                <li key={user.id} className="flex items-center gap-3 px-5 py-3.5">
                  <Avatar name={user.name} hue={user.avatarHue} size={32} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">{user.name}</p>
                    <p className="truncate text-xs text-faint">
                      Balance {money(user.balance, { compact: true })}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-sm text-ink">
                    {money(deployed, { compact: true })}
                  </span>
                </li>
              ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
