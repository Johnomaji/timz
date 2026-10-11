"use client";

import { usePathname } from "next/navigation";
import { isOpenWhileUnverified, VerificationGate } from "@/components/kyc-gate";
import { AppShell } from "@/components/shell";

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  const pathname = usePathname();

  return (
    <AppShell role="user">
      {isOpenWhileUnverified(pathname) ? children : <VerificationGate>{children}</VerificationGate>}
    </AppShell>
  );
}
