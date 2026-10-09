import type { Plan, Settings, User } from "@/lib/types";
import { getBrowserClient } from "./client";

export interface WriteResult {
  ok: boolean;
  error?: string;
}

/**
 * Money and privilege changes go through the RPCs in 20261007120000_write_rpcs.sql.
 * The messages they raise are written to be shown to the user, so error.message is
 * surfaced as-is. Everything else below is a direct table write that existing RLS and
 * the column grants already allow.
 */
async function rpc(name: string, args: Record<string, unknown>): Promise<WriteResult> {
  const { error } = await getBrowserClient().rpc(name, args);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export const requestDeposit = (amount: number, method: string) =>
  rpc("request_deposit", { p_amount: amount, p_method: method });

export const requestWithdrawal = (amount: number, method: string, address: string) =>
  rpc("request_withdrawal", { p_amount: amount, p_method: method, p_address: address });

export const invest = (planId: string, amount: number) =>
  rpc("invest", { p_plan_id: planId, p_amount: amount });

export const collectInvestment = (investmentId: string) =>
  rpc("collect_investment", { p_investment_id: investmentId });

export const resolveTransaction = (
  id: string,
  decision: "approved" | "rejected",
  note?: string,
) => rpc("resolve_transaction", { p_tx_id: id, p_decision: decision, p_note: note ?? null });

export const adjustBalance = (userId: string, delta: number, note: string) =>
  rpc("adjust_balance", { p_user_id: userId, p_delta: delta, p_note: note });

export const setUserStatus = (userId: string, status: User["status"]) =>
  rpc("set_user_status", { p_user_id: userId, p_status: status });

export async function updateProfile(
  userId: string,
  patch: Partial<Pick<User, "name" | "phone" | "country" | "twoFactor">>,
): Promise<WriteResult> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.phone !== undefined) row.phone = patch.phone;
  if (patch.country !== undefined) row.country = patch.country;
  if (patch.twoFactor !== undefined) row.two_factor = patch.twoFactor;
  if (Object.keys(row).length === 0) return { ok: true };

  const { error } = await getBrowserClient().from("profiles").update(row).eq("id", userId);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function markNotificationRead(id: string): Promise<WriteResult> {
  const { error } = await getBrowserClient()
    .from("notifications")
    .update({ read: true })
    .eq("id", id);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function markAllNotificationsRead(userId: string): Promise<WriteResult> {
  const { error } = await getBrowserClient()
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function savePlan(plan: Plan): Promise<WriteResult> {
  const { error } = await getBrowserClient().from("plans").upsert({
    id: plan.id,
    name: plan.name,
    tagline: plan.tagline,
    roi_min_pct: plan.roiMinPct,
    roi_max_pct: plan.roiMaxPct,
    duration_days: plan.durationDays,
    min_amount: plan.minAmount,
    max_amount: plan.maxAmount,
    accent: plan.accent,
    perks: plan.perks,
    active: plan.active,
  });
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function deletePlan(planId: string): Promise<WriteResult> {
  const { error } = await getBrowserClient().from("plans").delete().eq("id", planId);
  if (!error) return { ok: true };

  // investments.plan_id is ON DELETE RESTRICT, and the raw FK message is unreadable.
  return {
    ok: false,
    error:
      error.code === "23503"
        ? "This plan has investments against it and cannot be deleted. Deactivate it instead."
        : error.message,
  };
}

export async function saveSettings(settings: Settings): Promise<WriteResult> {
  const { error } = await getBrowserClient()
    .from("settings")
    .update({
      platform_name: settings.platformName,
      support_email: settings.supportEmail,
      min_deposit: settings.minDeposit,
      min_withdrawal: settings.minWithdrawal,
      withdrawal_fee_pct: settings.withdrawalFeePct,
      referral_commission_pct: settings.referralCommissionPct,
      maintenance_mode: settings.maintenanceMode,
      signups_open: settings.signupsOpen,
      wallets: settings.wallets,
    })
    .eq("id", true);
  return error ? { ok: false, error: error.message } : { ok: true };
}

export async function changePassword(
  email: string,
  current: string,
  next: string,
): Promise<WriteResult> {
  if (next.length < 6) return { ok: false, error: "Use at least 6 characters." };

  const supabase = getBrowserClient();

  // A live session can set a new password without proving the old one, so the current
  // password is checked explicitly — otherwise a hijacked session could lock the owner out.
  const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: current });
  if (verifyError) return { ok: false, error: "Current password is wrong." };

  const { error } = await supabase.auth.updateUser({ password: next });
  return error ? { ok: false, error: error.message } : { ok: true };
}
