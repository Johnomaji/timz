import type { DB } from "@/lib/types";
import { getBrowserClient } from "./client";
import {
  INVESTMENT_COLUMNS,
  NOTIFICATION_COLUMNS,
  PLAN_COLUMNS,
  PROFILE_COLUMNS,
  SETTINGS_COLUMNS,
  TRANSACTION_COLUMNS,
  mapInvestment,
  mapNotification,
  mapPlan,
  mapProfile,
  mapSettings,
  mapTransaction,
  type InvestmentRow,
  type NotificationRow,
  type PlanRow,
  type ProfileRow,
  type SettingsRow,
  type TransactionRow,
} from "./mappers";

/**
 * Builds the same DB shape the localStorage store uses, so pages reading `db.*`
 * work unchanged. RLS decides the row set: a user sees only their own records,
 * an admin sees everyone's, so `db.users` is naturally scoped to the viewer.
 */
export async function loadDb(): Promise<DB> {
  const supabase = getBrowserClient();

  const {
    data: { session },
  } = await supabase.auth.getSession();
  const sessionUserId = session?.user.id ?? null;

  const [plansRes, settingsRes] = await Promise.all([
    supabase.from("plans").select(PLAN_COLUMNS).order("sort_order"),
    supabase.from("settings").select(SETTINGS_COLUMNS).single(),
  ]);

  if (!settingsRes.data) {
    throw new Error(`Could not read platform settings: ${settingsRes.error?.message ?? "no row"}`);
  }

  const db: DB = {
    users: [],
    plans: ((plansRes.data ?? []) as PlanRow[]).map(mapPlan),
    investments: [],
    transactions: [],
    notifications: [],
    settings: mapSettings(settingsRes.data as SettingsRow),
    sessionUserId,
  };

  if (!sessionUserId) return db;

  const [profilesRes, investmentsRes, transactionsRes, notificationsRes] = await Promise.all([
    supabase.from("profiles").select(PROFILE_COLUMNS).order("joined_at"),
    supabase.from("investments").select(INVESTMENT_COLUMNS).order("started_at", { ascending: false }),
    supabase
      .from("transactions")
      .select(TRANSACTION_COLUMNS)
      .order("created_at", { ascending: false }),
    supabase
      .from("notifications")
      .select(NOTIFICATION_COLUMNS)
      .order("created_at", { ascending: false }),
  ]);

  return {
    ...db,
    users: ((profilesRes.data ?? []) as ProfileRow[]).map(mapProfile),
    investments: ((investmentsRes.data ?? []) as InvestmentRow[]).map(mapInvestment),
    transactions: ((transactionsRes.data ?? []) as TransactionRow[]).map(mapTransaction),
    notifications: ((notificationsRes.data ?? []) as NotificationRow[]).map(mapNotification),
  };
}
