"use client";

import { Download, Receipt, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeading } from "@/components/shell";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Select,
  statusTone,
  TableShell,
  Tabs,
  Td,
  Th,
} from "@/components/ui";
import { useMoney, useStore } from "@/lib/store";
import type { TxKind } from "@/lib/types";
import { dateTime } from "@/lib/utils";

type KindFilter = "all" | TxKind;

const KIND_TABS: { value: KindFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "deposit", label: "Deposits" },
  { value: "withdrawal", label: "Withdrawals" },
  { value: "investment", label: "Investments" },
  { value: "earning", label: "Earnings" },
  { value: "referral", label: "Referrals" },
  { value: "adjustment", label: "Adjustments" },
];

const OUTFLOWS: TxKind[] = ["withdrawal", "investment"];

export default function TransactionsPage() {
  const { db, currentUser } = useStore();
  const money = useMoney();
  const [kind, setKind] = useState<KindFilter>("all");
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");

  const mine = useMemo(
    () => db.transactions.filter((t) => t.userId === currentUser?.id),
    [db.transactions, currentUser?.id],
  );

  const filtered = useMemo(
    () =>
      mine.filter((t) => {
        if (kind !== "all" && t.kind !== kind) return false;
        if (status !== "all" && t.status !== status) return false;
        if (query) {
          const haystack = `${t.reference} ${t.method} ${t.note} ${t.kind}`.toLowerCase();
          if (!haystack.includes(query.toLowerCase())) return false;
        }
        return true;
      }),
    [mine, kind, status, query],
  );

  const inflow = filtered
    .filter((t) => !OUTFLOWS.includes(t.kind) && t.status !== "rejected")
    .reduce((sum, t) => sum + t.amount, 0);
  const outflow = filtered
    .filter((t) => OUTFLOWS.includes(t.kind) && t.status !== "rejected")
    .reduce((sum, t) => sum + t.amount, 0);

  const exportCsv = () => {
    const header = "Reference,Kind,Method,Amount,Status,Note,Created\n";
    const rows = filtered
      .map((t) =>
        [t.reference, t.kind, t.method, t.amount, t.status, `"${t.note.replace(/"/g, '""')}"`, t.createdAt].join(
          ",",
        ),
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "apexvest-transactions.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!currentUser) return null;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeading
        title="Transactions"
        description="Every movement on your account in one ledger."
        action={
          <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
            <Download className="size-4" />
            Export CSV
          </Button>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-muted">Records</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-ink">{filtered.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">Credits</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-brand">+{money(inflow)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">Debits</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-ink">−{money(outflow)}</p>
        </Card>
      </div>

      <Tabs tabs={KIND_TABS} value={kind} onChange={setKind} className="mb-4" />

      <div className="mb-5 flex flex-wrap gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint" />
          <Input
            className="pl-10"
            placeholder="Search reference, method or note"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <Select
          className="w-auto min-w-40"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="all">Any status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="completed">Completed</option>
          <option value="rejected">Rejected</option>
        </Select>
      </div>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Receipt className="size-5" />}
            title="No matching transactions"
            description="Try clearing the filters or search term."
          />
        ) : (
          <TableShell>
            <thead>
              <tr>
                <Th>Reference</Th>
                <Th>Type</Th>
                <Th>Method</Th>
                <Th>Note</Th>
                <Th className="text-right">Amount</Th>
                <Th>Status</Th>
                <Th>Date</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((tx) => {
                const isOut = OUTFLOWS.includes(tx.kind);
                return (
                  <tr key={tx.id} className="transition-colors hover:bg-surface-2/40">
                    <Td className="font-mono text-xs">{tx.reference}</Td>
                    <Td className="capitalize">{tx.kind}</Td>
                    <Td className="text-muted">{tx.method}</Td>
                    <Td className="max-w-64 truncate text-muted">{tx.note}</Td>
                    <Td className={`text-right font-mono ${isOut ? "text-ink" : "text-brand"}`}>
                      {isOut ? "−" : "+"}
                      {money(tx.amount)}
                    </Td>
                    <Td>
                      <Badge tone={statusTone(tx.status)}>{tx.status}</Badge>
                    </Td>
                    <Td className="whitespace-nowrap text-muted">{dateTime(tx.createdAt)}</Td>
                  </tr>
                );
              })}
            </tbody>
          </TableShell>
        )}
      </Card>
    </div>
  );
}
