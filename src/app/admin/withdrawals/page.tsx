"use client";

import { ApprovalQueue } from "@/components/approval-queue";
import { PageHeading } from "@/components/shell";

export default function AdminWithdrawalsPage() {
  return (
    <div className="mx-auto max-w-7xl">
      <PageHeading
        title="Withdrawals"
        description="Release or decline payout requests. Funds are held from the moment a request is made."
      />
      <ApprovalQueue
        kind="withdrawal"
        approveLabel="Confirm payout sent"
        rejectHint="Rejecting returns the amount and the fee to the investor's available balance."
      />
    </div>
  );
}
