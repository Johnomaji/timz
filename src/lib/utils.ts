import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function money(value: number, opts?: { compact?: boolean; sign?: boolean }) {
  const abs = Math.abs(value);
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: opts?.compact && abs >= 10_000 ? "compact" : "standard",
    minimumFractionDigits: opts?.compact && abs >= 10_000 ? 0 : 2,
    maximumFractionDigits: opts?.compact && abs >= 10_000 ? 1 : 2,
  }).format(abs);
  if (opts?.sign && value !== 0) return `${value > 0 ? "+" : "-"}${formatted}`;
  return value < 0 ? `-${formatted}` : formatted;
}

export function pct(value: number, digits = 2) {
  return `${value.toFixed(digits)}%`;
}

export function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function dateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return shortDate(iso);
}

export function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`;
}

export function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function daysBetween(fromIso: string, to = Date.now()) {
  return (to - new Date(fromIso).getTime()) / 86_400_000;
}

export function dayKey(date: Date, style: "day" | "weekday") {
  return style === "weekday"
    ? date.toLocaleDateString("en-US", { weekday: "short" })
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function emptyDayBuckets(count: number, style: "day" | "weekday") {
  const buckets = new Map<string, number>();
  for (let i = count - 1; i >= 0; i -= 1) {
    buckets.set(dayKey(new Date(Date.now() - i * 86_400_000), style), 0);
  }
  return buckets;
}

export function maskAddress(address: string) {
  if (address.length <= 14) return address;
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}
