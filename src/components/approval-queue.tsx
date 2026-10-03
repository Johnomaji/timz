"use client";

import { Check, Inbox, Search, X } from "lucide-react";
import { useState } from "react";
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
  Textarea,
} from "@/components/ui";
import { useMoney, useStore } from "@/lib/store";
import type { Transaction, TxKind } from "@/lib/types";
import { dateTime } from "@/lib/utils";

type StatusFilter = "pending" | "approved" | "rejected" | "all";

export function ApprovalQueue({
  kind,
  approveLabel,
  rejectHint,
}: {
  kind: Extract<TxKind, "deposit" | "withdrawal">;
  approveLabel: string;
  rejectHint: string;
}) {
  const { db, resolveTransaction } = useStore();
  const money = useMoney();
  const [status, setStatus] = useState<StatusFilter>("pending");
  const [query, setQuery] = useState("");
  const [action, setAction] = useState<{ tx: Transaction; decision: "approved" | "rejected" } | null>(
    null,
  );
  const [note, setNote] = useState("");

  const all = db.transactions.filter((t) => t.kind === kind);
  const counts = {
    pending: all.filter((t) => t.status === "pending").length,
    approved: all.filter((t) => t.status === "approved").length,
    rejected: all.filter((t) => t.status === "rejected").length,
    all: all.length,
  };

  const userFor = (id: string) => db.users.find((u) => u.id === id);

  const filtered = all.filter((tx) => {
    if (status !== "all" && tx.status !== status) return false;
    if (query) {
      const user = userFor(tx.userId);
      const haystack = `${tx.reference} ${tx.method} ${tx.note} ${user?.name ?? ""} ${user?.email ?? ""}`;
      if (!haystack.toLowerCase().includes(query.toLowerCase())) return false;
    }
    return true;
  });

  const pendingValue = all
    .filter((t) => t.status === "pending")
    .reduce((sum, t) => sum + t.amount, 0);

  const confirm = () => {
    if (!action) return;
    resolveTransaction(action.tx.id, action.decision, note.trim() || undefined);
    setAction(null);
    setNote("");
  };

  const actionUser = action ? userFor(action.tx.userId) : undefined;

  return (
    <>
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-muted">Awaiting review</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-warn">{counts.pending}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">Value on hold</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-ink">{money(pendingValue)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">Processed all-time</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-ink">
            {counts.approved + counts.rejected}
          </p>
        </Card>
      </div>

      <Tabs
        tabs={[
          { value: "pending", label: "Pending", count: counts.pending },
          { value: "approved", label: "Approved" },
          { value: "rejected", label: "Rejected" },
          { value: "all", label: "All" },
        ]}
        value={status}
        onChange={setStatus}
        className="mb-4"
      />

      <div className="relative mb-5 max-w-md">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-faint" />
        <Input
          className="pl-10"
          placeholder="Search investor, reference or method"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Inbox className="size-5" />}
            title={status === "pending" ? "Queue is clear" : "Nothing to show"}
            description={
              status === "pending"
                ? `No ${kind}s are waiting for review right now.`
                : "Try a different filter."
            }
          />
        ) : (
          <TableShell className="min-w-full">
            <thead>
              <tr>
                <Th>Investor</Th>
                <Th>Reference</Th>
                <Th>Method</Th>
                <Th className="text-right">Amount</Th>
                <Th>Requested</Th>
                <Th>Status</Th>
                <Th className="text-right">Decision</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((tx) => {
                const user = userFor(tx.userId);
                return (
                  <tr key={tx.id} className="transition-colors hover:bg-surface-2/40">
                    <Td>
                      <span className="flex items-center gap-2.5">
                        {user && <Avatar name={user.name} hue={user.avatarHue} size={32} />}
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-ink">
                            {user?.name ?? "Unknown"}
                          </span>
                          <span className="block truncate text-xs text-faint">
                            Balance {money(user?.balance ?? 0, { compact: true })}
                          </span>
                        </span>
                      </span>
                    </Td>
                    <Td className="font-mono text-xs">{tx.reference}</Td>
                    <Td className="max-w-48 truncate text-muted">{tx.method}</Td>
                    <Td className="text-right font-mono font-medium">{money(tx.amount)}</Td>
                    <Td className="whitespace-nowrap text-muted">{dateTime(tx.createdAt)}</Td>
                    <Td>
                      <Badge tone={statusTone(tx.status)}>{tx.status}</Badge>
                    </Td>
                    <Td>
                      {tx.status === "pending" ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              setAction({ tx, decision: "approved" });
                              setNote("");
                            }}
                          >
                            <Check className="size-3.5" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => {
                              setAction({ tx, decision: "rejected" });
                              setNote("");
                            }}
                          >
                            <X className="size-3.5" />
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <p className="text-right text-xs text-faint">
                          {tx.resolvedAt ? dateTime(tx.resolvedAt) : "—"}
                        </p>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableShell>
        )}
      </Card>

      <Modal
        open={action !== null}
        onClose={() => setAction(null)}
        title={action?.decision === "approved" ? approveLabel : `Reject this ${kind}`}
        description={
          action
            ? `${actionUser?.name ?? "Investor"} · ${money(action.tx.amount)} · ${action.tx.reference}`
            : undefined
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setAction(null)}>
              Cancel
            </Button>
            <Button variant={action?.decision === "approved" ? "primary" : "danger"} onClick={confirm}>
              {action?.decision === "approved" ? "Confirm approval" : "Confirm rejection"}
            </Button>
          </>
        }
      >
        {action && (
          <div className="space-y-4">
            <div className="space-y-2 rounded-xl border border-line bg-surface-2/50 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Investor balance now</span>
                <span className="font-mono text-ink">{money(actionUser?.balance ?? 0)}</span>
              </div>
              <div className="flex justify-between border-t border-line pt-2">
                <span className="text-muted">Balance after this decision</span>
                <span className="font-mono font-semibold text-ink">
                  {money(balanceAfter(action, actionUser?.balance ?? 0, db.settings.withdrawalFeePct))}
                </span>
              </div>
            </div>

            <p className="text-sm text-muted">
              {action.decision === "approved"
                ? kind === "deposit"
                  ? "Approving credits the investor's available balance immediately and notifies them."
                  : "Approving confirms the payout has been sent. The funds were already deducted when the request was made."
                : rejectHint}
            </p>

            <Field
              label={action.decision === "approved" ? "Internal note (optional)" : "Reason shown to the investor"}
            >
              <Textarea
                rows={3}
                placeholder={
                  action.decision === "approved"
                    ? "e.g. Matched on-chain transfer 0x9f…"
                    : "e.g. We could not match this payment to an incoming transfer."
                }
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
          </div>
        )}
      </Modal>
    </>
  );
}

function balanceAfter(
  action: { tx: Transaction; decision: "approved" | "rejected" },
  balance: number,
  feePct: number,
) {
  const { tx, decision } = action;
  if (tx.kind === "deposit") return decision === "approved" ? balance + tx.amount : balance;
  if (decision === "rejected") return balance + tx.amount + (tx.amount * feePct) / 100;
  return balance;
}
