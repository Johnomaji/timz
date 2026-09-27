"use client";

import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Bell,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Menu,
  Receipt,
  Settings,
  Share2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useStore } from "@/lib/store";
import type { Role } from "@/lib/types";
import { cn, money, timeAgo } from "@/lib/utils";
import { Avatar, Badge } from "./ui";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  badgeKey?: "deposits" | "withdrawals";
}

const USER_NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/plans", label: "Investment plans", icon: TrendingUp },
  { href: "/dashboard/deposit", label: "Deposit", icon: ArrowDownToLine },
  { href: "/dashboard/withdraw", label: "Withdraw", icon: ArrowUpFromLine },
  { href: "/dashboard/transactions", label: "Transactions", icon: Receipt },
  { href: "/dashboard/referrals", label: "Referrals", icon: Share2 },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/deposits", label: "Deposits", icon: ArrowDownToLine, badgeKey: "deposits" },
  { href: "/admin/withdrawals", label: "Withdrawals", icon: ArrowUpFromLine, badgeKey: "withdrawals" },
  { href: "/admin/plans", label: "Plans", icon: Sparkles },
  { href: "/admin/settings", label: "Platform settings", icon: Settings },
];

export function Brand({ className }: { className?: string }) {
  const { db } = useStore();
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span className="flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-brand to-cyan text-brand-ink">
        <Wallet className="size-4" strokeWidth={2.5} />
      </span>
      <span className="text-lg font-semibold tracking-tight text-ink">{db.settings.platformName}</span>
    </span>
  );
}

export function AppShell({ role, children }: { role: Role; children: ReactNode }) {
  const { currentUser, db, logout } = useStore();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (!currentUser) {
      router.replace("/login");
    } else if (currentUser.role !== role) {
      router.replace(currentUser.role === "admin" ? "/admin" : "/dashboard");
    }
  }, [currentUser, role, router]);

  const pendingCounts = useMemo(
    () => ({
      deposits: db.transactions.filter((t) => t.kind === "deposit" && t.status === "pending").length,
      withdrawals: db.transactions.filter((t) => t.kind === "withdrawal" && t.status === "pending")
        .length,
    }),
    [db.transactions],
  );

  if (!currentUser || currentUser.role !== role) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted">
        Redirecting…
      </div>
    );
  }

  const nav = role === "admin" ? ADMIN_NAV : USER_NAV;

  const sidebar = (
    <div className="flex h-full flex-col gap-1 p-4">
      <div className="mb-4 flex items-center justify-between px-1">
        <Link href={role === "admin" ? "/admin" : "/dashboard"}>
          <Brand />
        </Link>
        <button
          onClick={() => setMobileOpen(false)}
          className="rounded-lg p-1.5 text-muted hover:bg-surface-2 lg:hidden"
          aria-label="Close menu"
        >
          <X className="size-4" />
        </button>
      </div>

      {role === "admin" && (
        <Badge tone="violet" className="mx-1 mb-3 w-fit">
          <ShieldCheck className="size-3" />
          Admin console
        </Badge>
      )}

      <nav className="flex flex-1 flex-col gap-0.5">
        {nav.map((item) => {
          const active =
            item.href === "/dashboard" || item.href === "/admin"
              ? pathname === item.href
              : pathname.startsWith(item.href);
          const count = item.badgeKey ? pendingCounts[item.badgeKey] : 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={cn(
                "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                active
                  ? "bg-surface-2 font-medium text-ink"
                  : "text-muted hover:bg-surface-2/60 hover:text-ink",
              )}
            >
              <item.icon
                className={cn("size-4.5 shrink-0", active ? "text-brand" : "text-faint group-hover:text-muted")}
              />
              <span className="flex-1 truncate">{item.label}</span>
              {count > 0 && (
                <span className="rounded-full bg-warn/15 px-1.5 py-0.5 text-xs font-medium text-warn">
                  {count}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {role === "user" && (
        <div className="mt-4 rounded-xl border border-line bg-surface-2/50 p-4">
          <p className="text-xs text-faint">Available balance</p>
          <p className="mt-1 font-mono text-xl font-semibold text-ink">{money(currentUser.balance)}</p>
          <Link
            href="/dashboard/deposit"
            className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-brand-ink transition-colors hover:bg-brand-dark"
          >
            <ArrowDownToLine className="size-3.5" />
            Add funds
          </Link>
        </div>
      )}

      <button
        onClick={() => {
          logout();
          router.replace("/login");
        }}
        className="mt-3 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-muted transition-colors hover:bg-danger/10 hover:text-danger"
      >
        <LogOut className="size-4.5" />
        Sign out
      </button>
    </div>
  );

  return (
    <div className="flex min-h-screen">
      <aside className="fixed inset-y-0 z-30 hidden w-68 border-r border-line bg-surface/60 lg:block">
        {sidebar}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/70" onClick={() => setMobileOpen(false)} />
          <aside className="animate-pop absolute inset-y-0 left-0 w-72 border-r border-line bg-surface">
            {sidebar}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-68">
        <Topbar onMenu={() => setMobileOpen(true)} />
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

function Topbar({ onMenu }: { onMenu: () => void }) {
  const { currentUser, db, markAllNotificationsRead, markNotificationRead, logout } = useStore();
  const router = useRouter();
  const [openPanel, setOpenPanel] = useState<"bell" | "user" | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenPanel(null);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const notifications = useMemo(
    () => db.notifications.filter((n) => n.userId === currentUser?.id).slice(0, 8),
    [db.notifications, currentUser?.id],
  );
  const unread = notifications.filter((n) => !n.read).length;

  if (!currentUser) return null;

  const toneColor = {
    info: "bg-info",
    success: "bg-brand",
    warning: "bg-warn",
    danger: "bg-danger",
  } as const;

  return (
    <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-base/85 px-4 py-3 backdrop-blur-md sm:px-6 lg:px-8">
      <button
        onClick={onMenu}
        className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-ink lg:hidden"
        aria-label="Open menu"
      >
        <Menu className="size-5" />
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-muted">
          Welcome back, <span className="font-medium text-ink">{currentUser.name.split(" ")[0]}</span>
        </p>
      </div>

      <div ref={containerRef} className="flex items-center gap-1.5">
        <div className="relative">
          <button
            onClick={() => setOpenPanel(openPanel === "bell" ? null : "bell")}
            className="relative rounded-lg p-2 text-muted transition-colors hover:bg-surface-2 hover:text-ink"
            aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
          >
            <Bell className="size-5" />
            {unread > 0 && (
              <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-brand ring-2 ring-base" />
            )}
          </button>

          {openPanel === "bell" && (
            <div className="animate-pop absolute right-0 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl2 border border-line bg-surface shadow-2xl">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <p className="text-sm font-semibold text-ink">Notifications</p>
                {unread > 0 && (
                  <button
                    onClick={markAllNotificationsRead}
                    className="text-xs text-brand hover:underline"
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <div className="max-h-96 overflow-y-auto">
                {notifications.length === 0 && (
                  <p className="px-4 py-8 text-center text-sm text-muted">Nothing here yet.</p>
                )}
                {notifications.map((n) => (
                  <button
                    key={n.id}
                    onClick={() => markNotificationRead(n.id)}
                    className={cn(
                      "flex w-full gap-3 border-b border-line/60 px-4 py-3 text-left transition-colors hover:bg-surface-2/60",
                      !n.read && "bg-surface-2/40",
                    )}
                  >
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", toneColor[n.tone])} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-ink">{n.title}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-muted">{n.body}</span>
                      <span className="mt-1 block text-xs text-faint">{timeAgo(n.createdAt)}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="relative">
          <button
            onClick={() => setOpenPanel(openPanel === "user" ? null : "user")}
            className="flex items-center gap-2 rounded-lg p-1 pr-2 transition-colors hover:bg-surface-2"
          >
            <Avatar name={currentUser.name} hue={currentUser.avatarHue} size={32} />
            <ChevronDown className="size-4 text-muted" />
          </button>

          {openPanel === "user" && (
            <div className="animate-pop absolute right-0 mt-2 w-64 overflow-hidden rounded-xl2 border border-line bg-surface shadow-2xl">
              <div className="border-b border-line p-4">
                <p className="truncate font-medium text-ink">{currentUser.name}</p>
                <p className="truncate text-xs text-muted">{currentUser.email}</p>
                <Badge
                  tone={currentUser.role === "admin" ? "violet" : "success"}
                  className="mt-2 capitalize"
                >
                  {currentUser.role}
                </Badge>
              </div>
              <div className="p-1.5">
                <Link
                  href={currentUser.role === "admin" ? "/admin/settings" : "/dashboard/settings"}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted hover:bg-surface-2 hover:text-ink"
                >
                  <Settings className="size-4" />
                  Settings
                </Link>
                <button
                  onClick={() => {
                    logout();
                    router.replace("/login");
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-muted hover:bg-danger/10 hover:text-danger"
                >
                  <LogOut className="size-4" />
                  Sign out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export function PageHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}
