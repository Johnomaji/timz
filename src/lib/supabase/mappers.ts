import type {
  Investment,
  InvestmentStatus,
  KycStatus,
  Notification,
  Plan,
  Role,
  Settings,
  Transaction,
  TxKind,
  TxStatus,
  User,
  UserStatus,
} from "@/lib/types";

export interface ProfileRow {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: UserStatus;
  avatar_hue: number;
  balance: string | number;
  country: string;
  phone: string;
  joined_at: string;
  last_active_at: string;
  referral_code: string;
  referred_by: string | null;
  two_factor: boolean;
  kyc_status: KycStatus;
  kyc_session_id: string | null;
}

export const PROFILE_COLUMNS =
  "id,name,email,role,status,avatar_hue,balance,country,phone,joined_at,last_active_at,referral_code,referred_by,two_factor,kyc_status,kyc_session_id";

/** supabase-js returns numeric(18,2) as a string to avoid float drift. */
export function numeric(value: string | number): number {
  return typeof value === "number" ? value : Number.parseFloat(value);
}

export function mapProfile(row: ProfileRow): User {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    avatarHue: row.avatar_hue,
    balance: numeric(row.balance),
    country: row.country,
    phone: row.phone,
    joinedAt: row.joined_at,
    lastActiveAt: row.last_active_at,
    referralCode: row.referral_code,
    referredBy: row.referred_by,
    twoFactor: row.two_factor,
    kycStatus: row.kyc_status,
    kycSessionId: row.kyc_session_id,
  };
}

export const PLAN_COLUMNS =
  "id,name,tagline,roi_min_pct,roi_max_pct,duration_days,min_amount,max_amount,accent,perks,active";

export interface PlanRow {
  id: string;
  name: string;
  tagline: string;
  roi_min_pct: string | number;
  roi_max_pct: string | number;
  duration_days: number;
  min_amount: string | number;
  max_amount: string | number;
  accent: Plan["accent"];
  perks: string[];
  active: boolean;
}

export function mapPlan(row: PlanRow): Plan {
  return {
    id: row.id,
    name: row.name,
    tagline: row.tagline,
    roiMinPct: numeric(row.roi_min_pct),
    roiMaxPct: numeric(row.roi_max_pct),
    durationDays: row.duration_days,
    minAmount: numeric(row.min_amount),
    maxAmount: numeric(row.max_amount),
    accent: row.accent,
    perks: row.perks,
    active: row.active,
  };
}

export const INVESTMENT_COLUMNS =
  "id,user_id,plan_id,amount,started_at,status,roi_pct,payout_collected";

export interface InvestmentRow {
  id: string;
  user_id: string;
  plan_id: string;
  amount: string | number;
  started_at: string;
  status: InvestmentStatus;
  roi_pct: string | number;
  payout_collected: string | number;
}

export function mapInvestment(row: InvestmentRow): Investment {
  return {
    id: row.id,
    userId: row.user_id,
    planId: row.plan_id,
    amount: numeric(row.amount),
    startedAt: row.started_at,
    status: row.status,
    roiPct: numeric(row.roi_pct),
    payoutCollected: numeric(row.payout_collected),
  };
}

export const TRANSACTION_COLUMNS =
  "id,user_id,kind,amount,status,method,reference,note,created_at,resolved_at";

export interface TransactionRow {
  id: string;
  user_id: string;
  kind: TxKind;
  amount: string | number;
  status: TxStatus;
  method: string;
  reference: string;
  note: string;
  created_at: string;
  resolved_at: string | null;
}

export function mapTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind,
    amount: numeric(row.amount),
    status: row.status,
    method: row.method,
    reference: row.reference,
    note: row.note,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
  };
}

export const NOTIFICATION_COLUMNS = "id,user_id,title,body,tone,read,created_at";

export interface NotificationRow {
  id: string;
  user_id: string;
  title: string;
  body: string;
  tone: Notification["tone"];
  read: boolean;
  created_at: string;
}

export function mapNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    body: row.body,
    tone: row.tone,
    read: row.read,
    createdAt: row.created_at,
  };
}

export const SETTINGS_COLUMNS =
  "platform_name,support_email,min_deposit,min_withdrawal,withdrawal_fee_pct,referral_commission_pct,maintenance_mode,signups_open,wallets";

export interface SettingsRow {
  platform_name: string;
  support_email: string;
  min_deposit: string | number;
  min_withdrawal: string | number;
  withdrawal_fee_pct: string | number;
  referral_commission_pct: string | number;
  maintenance_mode: boolean;
  signups_open: boolean;
  wallets: Settings["wallets"];
}

export function mapSettings(row: SettingsRow): Settings {
  return {
    platformName: row.platform_name,
    supportEmail: row.support_email,
    minDeposit: numeric(row.min_deposit),
    minWithdrawal: numeric(row.min_withdrawal),
    withdrawalFeePct: numeric(row.withdrawal_fee_pct),
    referralCommissionPct: numeric(row.referral_commission_pct),
    maintenanceMode: row.maintenance_mode,
    signupsOpen: row.signups_open,
    wallets: row.wallets,
  };
}
