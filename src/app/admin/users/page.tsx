"use client";

import { Ban, Minus, Plus, Search, ShieldCheck, Undo2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeading } from "@/components/shell";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  Modal,
  statusTone,
  TableShell,
  Tabs,
  Td,
  Th,
} from "@/components/ui";
import { buildInvestmentView, useStore, type InvestmentView } from "@/lib/store";
import type { User } from "@/lib/types";
import { money, shortDate, timeAgo } from "@/lib/utils";

type Filter = "all" | "active" | "suspended" | "pending_kyc";

export default function AdminUsersPage() {
  const { db, setUserStatus, adjustBalance } = useStore();
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");
  const [detail, setDetail] = useState<User | null>(null);
  const [adjust, setAdjust] = useState<{ user: User; direction: 1 | -1 } | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustNote, setAdjustNote] = useState("Manual adjustment by admin");
  const [adjustError, setAdjustError] = useState("");

  const investors = useMemo(() => db.users.filter((u) => u.role === "user"), [db.users]);

  const counts = {
    all: investors.length,
    active: investors.filter((u) => u.status === "active").length,
    suspended: investors.filter((u) => u.status === "suspended").length,
    pending_kyc: investors.filter((u) => u.kycStatus === "pending").length,
  };

  const filtered = investors.filter((user) => {
    if (filter === "active" && user.status !== "active") return false;
    if (filter === "suspended" && user.status !== "suspended") return false;
    if (filter === "pending_kyc" && user.kycStatus !== "pending") return false;
    if (query) {
      const haystack = `${user.name} ${user.email} ${user.country} ${user.referralCode}`.toLowerCase();
      if (!haystack.includes(query.toLowerCase())) return false;
    }
    return true;
  });

  const deployedFor = (userId: string) =>
    db.investments
      .filter((i) => i.userId === userId && i.status === "active")
      .reduce((sum, i) => sum + i.amount, 0);

  const submitAdjust = () => {
    if (!adjust) return;
    const value = Number(adjustAmount);
    if (!Number.isFinite(value) || value <= 0) {
      setAdjustError("Enter an amount greater than zero.");
      return;
    }
    if (!adjustNote.trim()) {
      setAdjustError("Add a note so this adjustment is auditable.");
      return;
    }
    adjustBalance(adjust.user.id, value * adjust.direction, adjustNote.trim());
    setAdjust(null);
    setAdjustAmount("");
    setAdjustError("");
  };

  const detailInvestments = detail
    ? db.investments
        .filter((i) => i.userId === detail.id)
        .map((i) => buildInvestmentView(i, db.plans))
        .filter((i): i is InvestmentView => i !== null)
    : [];

  const liveDetail = detail ? (db.users.find((u) => u.id === detail.id) ?? detail) : null;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeading
        title="User management"
        description="Review investors, adjust balances and control account access."
      />

      <Tabs
        tabs={[
          { value: "all", label: "All users", count: counts.all },
          { value: "active", label: "Active", count: counts.active },
          { value: "suspended", label: "Suspended", count: counts.suspended },
          { value: "pending_kyc", label: "Pending KYC", count: counts.pending_kyc },
        ]}
        value={filter}
        onChange={setFilter}
        className="mb-4"
      />

      <div className="relative mb-5 max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint" />
        <Input
          className="pl-10"
          placeholder="Search name, email, country or referral code"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState icon={<Users className="size-5" />} title="No users match that filter" />
        ) : (
          <TableShell className="min-w-full">
            <thead>
              <tr>
                <Th>Investor</Th>
                <Th className="text-right">Balance</Th>
                <Th className="text-right">Deployed</Th>
                <Th>KYC</Th>
                <Th>Status</Th>
                <Th>Last active</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((user) => (
                <tr key={user.id} className="transition-colors hover:bg-surface-2/40">
                  <Td>
                    <button
                      onClick={() => setDetail(user)}
                      className="flex items-center gap-3 text-left"
                    >
                      <Avatar name={user.name} hue={user.avatarHue} size={34} />
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-ink">{user.name}</span>
                        <span className="block truncate text-xs text-faint">{user.email}</span>
                      </span>
                    </button>
                  </Td>
                  <Td className="text-right font-mono">{money(user.balance)}</Td>
                  <Td className="text-right font-mono text-muted">
                    {money(deployedFor(user.id), { compact: true })}
                  </Td>
                  <Td>
                    <Badge tone={statusTone(user.kycStatus)}>{user.kycStatus}</Badge>
                  </Td>
                  <Td>
                    <Badge tone={statusTone(user.status)}>{user.status}</Badge>
                  </Td>
                  <Td className="whitespace-nowrap text-muted">{timeAgo(user.lastActiveAt)}</Td>
                  <Td>
                    <div className="flex justify-end gap-1.5">
                      <button
                        title="Credit balance"
                        aria-label={`Credit ${user.name}`}
                        onClick={() => {
                          setAdjust({ user, direction: 1 });
                          setAdjustError("");
                        }}
                        className="rounded-lg border border-line p-1.5 text-muted transition-colors hover:border-brand/50 hover:text-brand"
                      >
                        <Plus className="size-3.5" />
                      </button>
                      <button
                        title="Debit balance"
                        aria-label={`Debit ${user.name}`}
                        onClick={() => {
                          setAdjust({ user, direction: -1 });
                          setAdjustError("");
                        }}
                        className="rounded-lg border border-line p-1.5 text-muted transition-colors hover:border-warn/50 hover:text-warn"
                      >
                        <Minus className="size-3.5" />
                      </button>
                      <button
                        title={user.status === "active" ? "Suspend account" : "Reinstate account"}
                        aria-label={`${user.status === "active" ? "Suspend" : "Reinstate"} ${user.name}`}
                        onClick={() =>
                          setUserStatus(user.id, user.status === "active" ? "suspended" : "active")
                        }
                        className="rounded-lg border border-line p-1.5 text-muted transition-colors hover:border-danger/50 hover:text-danger"
                      >
                        {user.status === "active" ? (
                          <Ban className="size-3.5" />
                        ) : (
                          <Undo2 className="size-3.5" />
                        )}
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        )}
      </Card>

      <Modal
        open={adjust !== null}
        onClose={() => setAdjust(null)}
        title={adjust?.direction === 1 ? "Credit balance" : "Debit balance"}
        description={adjust ? `${adjust.user.name} Â· current ${money(adjust.user.balance)}` : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdjust(null)}>
              Cancel
            </Button>
            <Button variant={adjust?.direction === 1 ? "primary" : "danger"} onClick={submitAdjust}>
              {adjust?.direction === 1 ? "Credit account" : "Debit account"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Amount">
            <Input
              type="number"
              min="0.01"
              step="0.01"
              placeholder="500.00"
              value={adjustAmount}
              onChange={(e) => {
                setAdjustAmount(e.target.value);
                setAdjustError("");
              }}
            />
          </Field>
          <Field label="Reason" hint="Recorded on the user's transaction ledger">
            <Input value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} />
          </Field>
          {adjust && (
            <div className="flex items-center justify-between rounded-xl border border-line bg-surface-2/50 px-4 py-3 text-sm">
              <span className="text-muted">Balance after</span>
              <span className="font-mono text-ink">
                {money(
                  Math.max(0, adjust.user.balance + (Number(adjustAmount) || 0) * adjust.direction),
                )}
              </span>
            </div>
          )}
          {adjustError && (
            <p className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger">
              {adjustError}
            </p>
          )}
        </div>
      </Modal>

      <Modal
        open={liveDetail !== null}
        onClose={() => setDetail(null)}
        title={liveDetail?.name ?? ""}
        description={liveDetail?.email}
        size="lg"
        footer={
          liveDetail && (
            <>
              <Button
                variant={liveDetail.status === "active" ? "danger" : "secondary"}
                onClick={() =>
                  setUserStatus(liveDetail.id, liveDetail.status === "active" ? "suspended" : "active")
                }
              >
                {liveDetail.status === "active" ? "Suspend account" : "Reinstate account"}
              </Button>
              <Button variant="ghost" onClick={() => setDetail(null)}>
                Close
              </Button>
            </>
          )
        }
      >
        {liveDetail && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: "Balance", value: money(liveDetail.balance) },
                { label: "Deployed", value: money(deployedFor(liveDetail.id), { compact: true }) },
                { label: "Country", value: liveDetail.country },
                { label: "Joined", value: shortDate(liveDetail.joinedAt) },
              ].map((item) => (
                <div key={item.label} className="rounded-xl border border-line bg-surface-2/50 p-3.5">
                  <p className="text-xs text-faint">{item.label}</p>
                  <p className="mt-1 truncate font-mono text-sm text-ink">{item.value}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge tone={statusTone(liveDetail.status)}>{liveDetail.status}</Badge>
              <Badge tone={statusTone(liveDetail.kycStatus)}>KYC: {liveDetail.kycStatus}</Badge>
              <Badge tone={liveDetail.twoFactor ? "success" : "neutral"}>
                <ShieldCheck className="size-3" />
                2FA {liveDetail.twoFactor ? "on" : "off"}
              </Badge>
              <Badge tone="neutral">{liveDetail.referralCode}</Badge>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-ink">
                Investments ({detailInvestments.length})
              </p>
              {detailInvestments.length === 0 ? (
                <p className="rounded-xl border border-line bg-surface-2/40 px-4 py-6 text-center text-sm text-muted">
                  No investments on this account.
                </p>
              ) : (
                <ul className="divide-y divide-line/60 rounded-xl border border-line">
                  {detailInvestments.map((inv) => (
                    <li key={inv.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div>
                        <p className="text-sm text-ink">{inv.plan.name}</p>
                        <p className="text-xs text-faint">
                          {money(inv.amount)} Â· {Math.floor(inv.elapsedDays)}/
                          {inv.plan.durationDays} days
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm text-brand">+{money(inv.accrued)}</p>
                        <Badge tone={statusTone(inv.status)} className="mt-1">
                          {inv.status}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Button
                variant="outline"
                onClick={() => {
                  setAdjust({ user: liveDetail, direction: 1 });
                  setDetail(null);
                }}
              >
                <Plus className="size-4" />
                Credit balance
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setAdjust({ user: liveDetail, direction: -1 });
                  setDetail(null);
                }}
              >
                <Minus className="size-4" />
                Debit balance
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
