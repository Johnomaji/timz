"use client";

import { ApprovalQueue } from "@/components/approval-queue";
import { PageHeading } from "@/components/shell";

export default function AdminDepositsPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeading
        title="Deposits"
        description="Confirm incoming payments before crediting investor balances."
      />
      <ApprovalQueue
        kind="deposit"
        approveLabel="Approve and credit deposit"
        rejectHint="Rejecting leaves the balance untouched and notifies the investor with your reason."
      />
    </div>
  );
}
