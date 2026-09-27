"use client";

import { Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { PageHeading } from "@/components/shell";
import {
  Badge,
  Button,
  Card,
  Field,
  Input,
  Modal,
  Select,
  TableShell,
  Td,
  Th,
  Textarea,
  Toggle,
} from "@/components/ui";
import { useStore } from "@/lib/store";
import type { Plan } from "@/lib/types";
import { money, uid } from "@/lib/utils";

const ACCENTS: Plan["accent"][] = ["brand", "violet", "cyan", "warn"];

const blankPlan = (): Plan => ({
  id: uid("plan"),
  name: "",
  tagline: "",
  roiMinPct: 10,
  roiMaxPct: 15,
  durationDays: 90,
  minAmount: 100,
  maxAmount: 10_000,
  accent: "brand",
  perks: ["Rate locked in when you subscribe", "Principal plus ROI paid at maturity"],
  active: true,
});

export default function AdminPlansPage() {
  const { db, savePlan, deletePlan } = useStore();
  const [editing, setEditing] = useState<Plan | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [perkText, setPerkText] = useState("");
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<Plan | null>(null);

  const open = (plan: Plan, fresh: boolean) => {
    setEditing({ ...plan });
    setPerkText(plan.perks.join("\n"));
    setIsNew(fresh);
    setError("");
  };

  const subscribersFor = (planId: string) =>
    db.investments.filter((i) => i.planId === planId && i.status === "active");

  const submit = () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      setError("Give the plan a name.");
      return;
    }
    if (editing.roiMinPct <= 0 || editing.durationDays <= 0) {
      setError("ROI and duration must be greater than zero.");
      return;
    }
    if (editing.roiMaxPct < editing.roiMinPct) {
      setError("Maximum ROI cannot be below the minimum.");
      return;
    }
    if (editing.minAmount <= 0 || editing.maxAmount <= editing.minAmount) {
      setError("Maximum must be greater than minimum, and both above zero.");
      return;
    }
    savePlan({
      ...editing,
      name: editing.name.trim(),
      tagline: editing.tagline.trim(),
      perks: perkText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    });
    setEditing(null);
  };

  return (
    <div className="mx-auto max-w-7xl">
      <PageHeading
        title="Investment plans"
        description="Rates, terms and limits apply to every new subscription."
        action={
          <Button onClick={() => open(blankPlan(), true)}>
            <Plus className="size-4" />
            New plan
          </Button>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm text-muted">Plans configured</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-ink">{db.plans.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">Live plans</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-brand">
            {db.plans.filter((p) => p.active).length}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-sm text-muted">Active subscriptions</p>
          <p className="mt-2 font-mono text-2xl font-semibold text-ink">
            {db.investments.filter((i) => i.status === "active").length}
          </p>
        </Card>
      </div>

      <Card>
        <TableShell className="min-w-full">
          <thead>
            <tr>
              <Th>Plan</Th>
              <Th className="text-right">Term</Th>
              <Th className="text-right">Total ROI</Th>
              <Th>Range</Th>
              <Th className="text-right">Subscribers</Th>
              <Th>State</Th>
              <Th className="text-right">Actions</Th>
            </tr>
          </thead>
          <tbody>
            {db.plans.map((plan) => {
              const subs = subscribersFor(plan.id);
              return (
                <tr key={plan.id} className="transition-colors hover:bg-surface-2/40">
                  <Td>
                    <p className="font-medium text-ink">{plan.name}</p>
                    <p className="max-w-64 truncate text-xs text-faint">{plan.tagline}</p>
                  </Td>
                  <Td className="text-right font-mono">{plan.durationDays}d</Td>
                  <Td className="text-right font-mono text-brand">
                    {plan.roiMinPct}–{plan.roiMaxPct}%
                  </Td>
                  <Td className="whitespace-nowrap text-muted">
                    {money(plan.minAmount, { compact: true })} –{" "}
                    {money(plan.maxAmount, { compact: true })}
                  </Td>
                  <Td className="text-right font-mono">{subs.length}</Td>
                  <Td>
                    <Badge tone={plan.active ? "success" : "neutral"}>
                      {plan.active ? "Live" : "Hidden"}
                    </Badge>
                  </Td>
                  <Td>
                    <div className="flex justify-end gap-1.5">
                      <button
                        aria-label={`Edit ${plan.name}`}
                        onClick={() => open(plan, false)}
                        className="rounded-lg border border-line p-1.5 text-muted transition-colors hover:border-brand/50 hover:text-brand"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        aria-label={`Delete ${plan.name}`}
                        onClick={() => setConfirmDelete(plan)}
                        className="rounded-lg border border-line p-1.5 text-muted transition-colors hover:border-danger/50 hover:text-danger"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </TableShell>
      </Card>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={isNew ? "Create investment plan" : `Edit ${editing?.name || "plan"}`}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={submit}>{isNew ? "Create plan" : "Save changes"}</Button>
          </>
        }
      >
        {editing && (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Plan name">
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                />
              </Field>
              <Field label="Accent colour">
                <Select
                  value={editing.accent}
                  onChange={(e) =>
                    setEditing({ ...editing, accent: e.target.value as Plan["accent"] })
                  }
                >
                  {ACCENTS.map((accent) => (
                    <option key={accent} value={accent}>
                      {accent}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <Field label="Tagline">
              <Input
                placeholder="One line shown on the plan card"
                value={editing.tagline}
                onChange={(e) => setEditing({ ...editing, tagline: e.target.value })}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Minimum ROI (%)" hint="Total over the term, not per day">
                <Input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={editing.roiMinPct}
                  onChange={(e) => setEditing({ ...editing, roiMinPct: Number(e.target.value) })}
                />
              </Field>
              <Field label="Maximum ROI (%)">
                <Input
                  type="number"
                  step="0.1"
                  min="0.1"
                  value={editing.roiMaxPct}
                  onChange={(e) => setEditing({ ...editing, roiMaxPct: Number(e.target.value) })}
                />
              </Field>
              <Field label="Term (days)">
                <Input
                  type="number"
                  min="1"
                  value={editing.durationDays}
                  onChange={(e) => setEditing({ ...editing, durationDays: Number(e.target.value) })}
                />
              </Field>
              <Field label="Minimum amount">
                <Input
                  type="number"
                  min="1"
                  value={editing.minAmount}
                  onChange={(e) => setEditing({ ...editing, minAmount: Number(e.target.value) })}
                />
              </Field>
              <Field label="Maximum amount">
                <Input
                  type="number"
                  min="1"
                  value={editing.maxAmount}
                  onChange={(e) => setEditing({ ...editing, maxAmount: Number(e.target.value) })}
                />
              </Field>
            </div>

            <Field label="Perks" hint="One per line">
              <Textarea rows={4} value={perkText} onChange={(e) => setPerkText(e.target.value)} />
            </Field>

            <div className="rounded-xl border border-line bg-surface-2/50 px-4">
              <Toggle
                label="Plan is live"
                description="Hidden plans stay intact but cannot be subscribed to"
                checked={editing.active}
                onChange={(next) => setEditing({ ...editing, active: next })}
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border border-brand/25 bg-brand/8 px-4 py-3 text-sm">
              <span className="flex items-center gap-2 text-muted">
                <Sparkles className="size-4 text-brand" />
                Each subscription locks a rate drawn from this range
              </span>
              <span className="font-mono font-semibold text-brand">
                {editing.roiMinPct}–{editing.roiMaxPct}% / {editing.durationDays}d
              </span>
            </div>

            {error && (
              <p className="rounded-xl border border-danger/30 bg-danger/10 px-3.5 py-3 text-sm text-danger">
                {error}
              </p>
            )}
          </div>
        )}
      </Modal>

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title={`Delete ${confirmDelete?.name ?? "plan"}?`}
        description="Existing subscriptions keep running, but the plan disappears from the catalogue."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (confirmDelete) deletePlan(confirmDelete.id);
                setConfirmDelete(null);
              }}
            >
              Delete plan
            </Button>
          </>
        }
      >
        {confirmDelete && subscribersFor(confirmDelete.id).length > 0 && (
          <p className="rounded-xl border border-warn/30 bg-warn/8 px-4 py-3 text-sm text-muted">
            {subscribersFor(confirmDelete.id).length} investor
            {subscribersFor(confirmDelete.id).length === 1 ? " is" : "s are"} currently subscribed.
            Consider hiding the plan instead so their dashboards keep rendering correctly.
          </p>
        )}
      </Modal>
    </div>
  );
}
