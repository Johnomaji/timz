"use client";

import { BellOff, CheckCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { PageHeading } from "@/components/shell";
import { Button, Card, EmptyState, Tabs } from "@/components/ui";
import { useStore } from "@/lib/store";
import type { Notification } from "@/lib/types";
import { cn, timeAgo } from "@/lib/utils";

const TONE_DOT: Record<Notification["tone"], string> = {
  info: "bg-info",
  success: "bg-brand",
  warning: "bg-warn",
  danger: "bg-danger",
};

export default function NotificationsPage() {
  const { db, currentUser, markNotificationRead, markAllNotificationsRead } = useStore();
  const [tab, setTab] = useState<"all" | "unread">("all");

  const mine = useMemo(
    () => db.notifications.filter((n) => n.userId === currentUser?.id),
    [db.notifications, currentUser?.id],
  );

  if (!currentUser) return null;

  const unread = mine.filter((n) => !n.read);
  const shown = tab === "unread" ? unread : mine;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeading
        title="Notifications"
        description="Account activity, approvals and plan updates."
        action={
          unread.length > 0 && (
            <Button variant="outline" onClick={() => void markAllNotificationsRead()}>
              <CheckCheck className="size-4" />
              Mark all read
            </Button>
          )
        }
      />

      <Tabs
        className="mb-5"
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "all", label: "All", count: mine.length },
          { value: "unread", label: "Unread", count: unread.length },
        ]}
      />

      <Card>
        {shown.length === 0 ? (
          <EmptyState
            icon={<BellOff className="size-5" />}
            title={tab === "unread" ? "Nothing unread" : "No notifications yet"}
            description={
              tab === "unread"
                ? "You're all caught up."
                : "We'll let you know when something happens on your account."
            }
          />
        ) : (
          <ul className="divide-y divide-line/60">
            {shown.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => {
                    if (!n.read) void markNotificationRead(n.id);
                  }}
                  disabled={n.read}
                  className={cn(
                    "flex w-full gap-3.5 px-5 py-4 text-left transition-colors",
                    !n.read && "bg-surface-2/40 hover:bg-surface-2/70",
                  )}
                >
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", TONE_DOT[n.tone])} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-medium text-ink">{n.title}</span>
                      {!n.read && (
                        <span className="rounded-full bg-brand/15 px-1.5 py-0.5 text-xs font-medium text-brand">
                          New
                        </span>
                      )}
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed text-muted">{n.body}</span>
                    <span className="mt-1.5 block text-xs text-faint">{timeAgo(n.createdAt)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
