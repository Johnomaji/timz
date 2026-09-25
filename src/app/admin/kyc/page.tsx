"use client";

import { Check, FileText, ShieldCheck, X } from "lucide-react";
import { useState } from "react";
import { PageHeading } from "@/components/shell";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Modal,
  statusTone,
  TableShell,
  Tabs,
  Td,
  Th,
  Textarea,
} from "@/components/ui";
import { useStore } from "@/lib/store";
import type { KycSubmission } from "@/lib/types";
import { dateTime } from "@/lib/utils";

const DOC_LABELS: Record<KycSubmission["documentType"], string> = {
  passport: "Passport",
  national_id: "National ID",
  drivers_license: "Driver's licence",
};

type Filter = "pending" | "verified" | "rejected" | "all";

export default function AdminKycPage() {
  const { db, reviewKyc } = useStore();
  const [filter, setFilter] = useState<Filter>("pending");
  const [action, setAction] = useState<{
    sub: KycSubmission;
    decision: "verified" | "rejected";
  } | null>(null);
  const [note, setNote] = useState("");

  const counts = {
    pending: db.kyc.filter((k) => k.status === "pending").length,
    verified: db.kyc.filter((k) => k.status === "verified").length,
    rejected: db.kyc.filter((k) => k.status === "rejected").length,
    all: db.kyc.length,
  };

  const filtered = db.kyc.filter((k) => filter === "all" || k.status === filter);
  const userFor = (id: string) => db.users.find((u) => u.id === id);

  const confirm = () => {
    if (!action) return;
    if (action.decision === "rejected" && !note.trim()) return;
    reviewKyc(action.sub.id, action.decision, note.trim() || undefined);
    setAction(null);
    setNote("");
  };

  const actionUser = action ? userFor(action.sub.userId) : undefined;

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeading
        title="KYC queue"
        description="Review identity documents. Approving unlocks withdrawals for the investor."
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-muted">Awaiting review</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-warn">{counts.pending}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">Verified</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-brand">
            {db.users.filter((u) => u.kycStatus === "verified" && u.role === "user").length}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">Rejected</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-ink">{counts.rejected}</p>
        </Card>
      </div>

      <Tabs
        tabs={[
          { value: "pending", label: "Pending", count: counts.pending },
          { value: "verified", label: "Verified" },
          { value: "rejected", label: "Rejected" },
          { value: "all", label: "All" },
        ]}
        value={filter}
        onChange={setFilter}
        className="mb-5"
      />

      <Card>
        {filtered.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck className="size-5" />}
            title={filter === "pending" ? "Queue is clear" : "Nothing to show"}
            description={
              filter === "pending" ? "No submissions are waiting for review." : "Try another filter."
            }
          />
        ) : (
          <TableShell className="min-w-full">
            <thead>
              <tr>
                <Th>Investor</Th>
                <Th>Document</Th>
                <Th>Number</Th>
                <Th>File</Th>
                <Th>Submitted</Th>
                <Th>Status</Th>
                <Th className="text-right">Decision</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((sub) => {
                const user = userFor(sub.userId);
                return (
                  <tr key={sub.id} className="transition-colors hover:bg-surface-2/40">
                    <Td>
                      <span className="flex items-center gap-2.5">
                        {user && <Avatar name={user.name} hue={user.avatarHue} size={32} />}
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-ink">{sub.fullName}</span>
                          <span className="block truncate text-xs text-faint">{user?.email}</span>
                        </span>
                      </span>
                    </Td>
                    <Td className="text-muted">{DOC_LABELS[sub.documentType]}</Td>
                    <Td className="font-mono text-xs">{sub.documentNumber}</Td>
                    <Td>
                      <span className="flex items-center gap-1.5 text-xs text-muted">
                        <FileText className="size-3.5 shrink-0" />
                        <span className="max-w-40 truncate">{sub.fileName}</span>
                        <span className="text-faint">({Math.round(sub.fileSize / 1024)} KB)</span>
                      </span>
                    </Td>
                    <Td className="whitespace-nowrap text-muted">{dateTime(sub.submittedAt)}</Td>
                    <Td>
                      <Badge tone={statusTone(sub.status)}>{sub.status}</Badge>
                    </Td>
                    <Td>
                      {sub.status === "pending" ? (
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            onClick={() => {
                              setAction({ sub, decision: "verified" });
                              setNote("");
                            }}
                          >
                            <Check className="size-3.5" />
                            Verify
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            onClick={() => {
                              setAction({ sub, decision: "rejected" });
                              setNote("");
                            }}
                          >
                            <X className="size-3.5" />
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <p className="text-right text-xs text-faint">
                          {sub.reviewedAt ? dateTime(sub.reviewedAt) : "—"}
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
        title={action?.decision === "verified" ? "Verify this investor" : "Reject this submission"}
        description={action ? `${action.sub.fullName} · ${actionUser?.email ?? ""}` : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAction(null)}>
              Cancel
            </Button>
            <Button
              variant={action?.decision === "verified" ? "primary" : "danger"}
              onClick={confirm}
              disabled={action?.decision === "rejected" && !note.trim()}
            >
              {action?.decision === "verified" ? "Confirm verification" : "Confirm rejection"}
            </Button>
          </>
        }
      >
        {action && (
          <div className="space-y-4">
            <div className="space-y-2 rounded-xl border border-line bg-surface-2/50 p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Document</span>
                <span className="text-ink">{DOC_LABELS[action.sub.documentType]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Number</span>
                <span className="font-mono text-ink">{action.sub.documentNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">File</span>
                <span className="max-w-48 truncate text-ink">{action.sub.fileName}</span>
              </div>
            </div>

            <p className="text-sm text-muted">
              {action.decision === "verified"
                ? "Verifying lifts the withdrawal lock on this account and notifies the investor."
                : "The investor can resubmit after a rejection. Your reason is shown to them, so be specific."}
            </p>

            <Field
              label={
                action.decision === "verified"
                  ? "Internal note (optional)"
                  : "Reason shown to the investor (required)"
              }
            >
              <Textarea
                rows={3}
                placeholder={
                  action.decision === "verified"
                    ? "e.g. Document matches account name and is in date."
                    : "e.g. The document photo is blurred — please resubmit a sharper image."
                }
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Field>
          </div>
        )}
      </Modal>
    </div>
  );
}
