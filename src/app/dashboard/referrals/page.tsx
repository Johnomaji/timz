"use client";

import { Check, Copy, Gift, Link2, Share2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { StatCard } from "@/components/charts";
import { PageHeading } from "@/components/shell";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
  statusTone,
  TableShell,
  Td,
  Th,
} from "@/components/ui";
import { useMoney, useStore } from "@/lib/store";
import { shortDate, timeAgo } from "@/lib/utils";

export default function ReferralsPage() {
  const { db, currentUser } = useStore();
  const money = useMoney();
  const [copied, setCopied] = useState<"code" | "link" | null>(null);

  const referred = useMemo(
    () => db.users.filter((u) => u.referredBy === currentUser?.id),
    [db.users, currentUser?.id],
  );

  const commissions = useMemo(
    () => db.transactions.filter((t) => t.userId === currentUser?.id && t.kind === "referral"),
    [db.transactions, currentUser?.id],
  );

  if (!currentUser) return null;

  const totalEarned = commissions.reduce((sum, t) => sum + t.amount, 0);
  const referralLink =
    typeof window === "undefined"
      ? `/register?ref=${currentUser.referralCode}`
      : `${window.location.origin}/register?ref=${currentUser.referralCode}`;

  const copy = async (value: string, which: "code" | "link") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopied(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeading
        title="Referrals"
        description={`Receive ${db.settings.referralCommissionPct}% of the ROI from every referral.`}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="People referred" value={String(referred.length)} icon={Users} />
        <StatCard
          label="Commission earned"
          value={money(totalEarned)}
          sub={`${commissions.length} payouts`}
          icon={Gift}
          tone="violet"
        />
        <StatCard
          label="Referral reward"
          value={`${db.settings.referralCommissionPct}%`}
          sub="Of each referral's ROI"
          icon={Share2}
          tone="cyan"
        />
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Your invite details"
          subtitle="Share either one — new signups are attributed automatically"
        />
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">Referral code</p>
            <div className="flex gap-2">
              <Input readOnly value={currentUser.referralCode} className="font-mono" />
              <Button variant="outline" onClick={() => copy(currentUser.referralCode, "code")}>
                {copied === "code" ? <Check className="size-4" /> : <Copy className="size-4" />}
              </Button>
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">Referral link</p>
            <div className="flex gap-2">
              <Input readOnly value={referralLink} className="truncate" />
              <Button variant="outline" onClick={() => copy(referralLink, "link")}>
                {copied === "link" ? <Check className="size-4" /> : <Link2 className="size-4" />}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader title="Your referrals" subtitle={`${referred.length} signed up`} />
          {referred.length === 0 ? (
            <EmptyState
              icon={<Users className="size-5" />}
              title="No referrals yet"
              description="Share your link — you earn a cut of the ROI they make."
            />
          ) : (
            <ul className="divide-y divide-line/60">
              {referred.map((user) => (
                <li key={user.id} className="flex items-center gap-3 px-5 py-4">
                  <Avatar name={user.name} hue={user.avatarHue} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">{user.name}</p>
                    <p className="truncate text-xs text-faint">
                      {[`Joined ${shortDate(user.joinedAt)}`, user.country]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <Badge tone={statusTone(user.status)}>{user.status}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Commission payouts" subtitle={money(totalEarned) + " lifetime"} />
          {commissions.length === 0 ? (
            <EmptyState
              icon={<Gift className="size-5" />}
              title="No commission yet"
              description="Paid the moment a referred investor activates a plan."
            />
          ) : (
            <TableShell className="min-w-0">
              <thead>
                <tr>
                  <Th>Source</Th>
                  <Th className="text-right">Amount</Th>
                  <Th>When</Th>
                </tr>
              </thead>
              <tbody>
                {commissions.map((tx) => (
                  <tr key={tx.id}>
                    <Td className="max-w-48 truncate text-muted">{tx.note}</Td>
                    <Td className="text-right font-mono text-brand">+{money(tx.amount)}</Td>
                    <Td className="whitespace-nowrap text-muted">{timeAgo(tx.createdAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </TableShell>
          )}
        </Card>
      </div>
    </div>
  );
}
