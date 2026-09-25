"use client";

import { AlertCircle, BadgeCheck, Clock, FileCheck2, ShieldX, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { PageHeading } from "@/components/shell";
import { Badge, Button, Card, CardHeader, Field, Input, Select } from "@/components/ui";
import { useStore } from "@/lib/store";
import type { KycSubmission } from "@/lib/types";
import { dateTime } from "@/lib/utils";

const DOC_LABELS: Record<KycSubmission["documentType"], string> = {
  passport: "Passport",
  national_id: "National ID card",
  drivers_license: "Driver's licence",
};

const REQUIREMENTS = [
  "Full document visible with no cropped corners",
  "All text sharp and readable, no glare",
  "Issued document that has not expired",
  "File under 5 MB in JPG, PNG or PDF format",
];

export default function KycPage() {
  const { db, currentUser, submitKyc } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    fullName: currentUser?.name ?? "",
    documentType: "passport" as KycSubmission["documentType"],
    documentNumber: "",
  });
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState("");

  if (!currentUser) return null;

  const submission = db.kyc.find((k) => k.userId === currentUser.id);
  const status = currentUser.kycStatus;

  const statusCard = {
    verified: {
      icon: BadgeCheck,
      tone: "border-brand/30 bg-brand/8",
      iconColor: "text-brand",
      title: "Identity verified",
      body: "Your account is fully verified. All withdrawal limits are lifted.",
    },
    pending: {
      icon: Clock,
      tone: "border-warn/30 bg-warn/8",
      iconColor: "text-warn",
      title: "Under review",
      body: "Our compliance desk is checking your documents. This usually takes a few hours.",
    },
    rejected: {
      icon: ShieldX,
      tone: "border-danger/30 bg-danger/8",
      iconColor: "text-danger",
      title: "Verification rejected",
      body: submission?.reviewNote || "Please upload a clearer copy of your document.",
    },
    unverified: {
      icon: AlertCircle,
      tone: "border-line bg-surface-2/50",
      iconColor: "text-muted",
      title: "Not verified yet",
      body: "Submit an identity document to unlock withdrawals on your account.",
    },
  }[status];

  const canSubmit = status === "unverified" || status === "rejected";

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.fullName.trim()) {
      setError("Enter the full name shown on your document.");
      return;
    }
    if (!form.documentNumber.trim()) {
      setError("Enter your document number.");
      return;
    }
    if (!file) {
      setError("Attach a photo or scan of your document.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("That file is larger than 5 MB.");
      return;
    }

    submitKyc({
      fullName: form.fullName.trim(),
      documentType: form.documentType,
      documentNumber: form.documentNumber.trim(),
      fileName: file.name,
      fileSize: file.size,
    });
    setError("");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeading
        title="Identity verification"
        description="A one-time check that unlocks withdrawals on your account."
      />

      <Card className={`mb-5 flex items-start gap-4 p-5 ${statusCard.tone}`}>
        <statusCard.icon className={`mt-0.5 size-5 shrink-0 ${statusCard.iconColor}`} />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink">{statusCard.title}</p>
          <p className="mt-0.5 text-sm text-muted">{statusCard.body}</p>
          {submission && (
            <p className="mt-2 text-xs text-faint">
              Submitted {dateTime(submission.submittedAt)} · {submission.fileName}
            </p>
          )}
        </div>
        <Badge
          tone={
            status === "verified"
              ? "success"
              : status === "pending"
                ? "warning"
                : status === "rejected"
                  ? "danger"
                  : "neutral"
          }
        >
          {status}
        </Badge>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader
            title="Submit your document"
            subtitle={canSubmit ? "All fields are required" : "Already submitted for this account"}
          />
          <form className="space-y-4 p-5" onSubmit={submit}>
            <Field label="Full legal name">
              <Input
                disabled={!canSubmit}
                value={form.fullName}
                onChange={(e) => {
                  setForm({ ...form, fullName: e.target.value });
                  setError("");
                }}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Document type">
                <Select
                  disabled={!canSubmit}
                  value={form.documentType}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      documentType: e.target.value as KycSubmission["documentType"],
                    })
                  }
                >
                  {Object.entries(DOC_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Document number">
                <Input
                  disabled={!canSubmit}
                  placeholder="e.g. P1234567"
                  value={form.documentNumber}
                  onChange={(e) => {
                    setForm({ ...form, documentNumber: e.target.value.toUpperCase() });
                    setError("");
                  }}
                />
              </Field>
            </div>

            <Field label="Document upload" hint="JPG, PNG or PDF up to 5 MB">
              <div
                className={`rounded-xl border border-dashed border-line bg-surface-2/40 p-6 text-center ${
                  canSubmit ? "" : "opacity-60"
                }`}
              >
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  disabled={!canSubmit}
                  className="hidden"
                  onChange={(e) => {
                    setFile(e.target.files?.[0] ?? null);
                    setError("");
                  }}
                />
                {file ? (
                  <div className="flex items-center justify-center gap-2.5 text-sm">
                    <FileCheck2 className="size-4 text-brand" />
                    <span className="text-ink">{file.name}</span>
                    <span className="text-faint">({Math.round(file.size / 1024)} KB)</span>
                  </div>
                ) : (
                  <>
                    <Upload className="mx-auto size-6 text-faint" />
                    <p className="mt-2.5 text-sm text-muted">No file selected</p>
                  </>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3.5"
                  disabled={!canSubmit}
                  onClick={() => fileRef.current?.click()}
                >
                  {file ? "Choose a different file" : "Select file"}
                </Button>
              </div>
            </Field>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger">
                <AlertCircle className="mt-0.5 size-4 shrink-0" />
                {error}
              </div>
            )}

            <Button type="submit" className="w-full" size="lg" disabled={!canSubmit}>
              {status === "rejected" ? "Resubmit for review" : "Submit for review"}
            </Button>
          </form>
        </Card>

        <Card className="h-fit">
          <CardHeader title="What we need" />
          <ul className="space-y-3 p-5">
            {REQUIREMENTS.map((req) => (
              <li key={req} className="flex gap-2.5 text-sm text-muted">
                <BadgeCheck className="mt-0.5 size-4 shrink-0 text-brand" />
                {req}
              </li>
            ))}
          </ul>
          <div className="border-t border-line p-5 text-xs leading-relaxed text-faint">
            Documents are reviewed by the compliance desk and are never shared with third parties. In
            this demo build, only the file name and size are recorded — the file itself never leaves
            your browser.
          </div>
        </Card>
      </div>
    </div>
  );
}
