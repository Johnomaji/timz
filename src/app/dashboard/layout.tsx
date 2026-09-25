"use client";

import { AppShell } from "@/components/shell";

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return <AppShell role="user">{children}</AppShell>;
}
