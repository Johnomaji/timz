export type Role = "user" | "admin";

export type UserStatus = "active" | "suspended";

/** Local projection of Didit's session status — see mapDiditStatus in lib/didit.ts. */
export type KycStatus = "unverified" | "pending" | "approved" | "declined";

export interface User {
  id: string;
  name: string;
  email: string;
  /** Absent under Supabase, where auth.users owns credentials. Demo mode only. */
  password?: string;
  role: Role;
  status: UserStatus;
  avatarHue: number;
  balance: number;
  country: string;
  phone: string;
  joinedAt: string;
  lastActiveAt: string;
  referralCode: string;
  referredBy: string | null;
  twoFactor: boolean;
  kycStatus: KycStatus;
  /** Most recent Didit session, so a returning user resumes instead of starting over. */
  kycSessionId: string | null;
}

export interface Plan {
  id: string;
  name: string;
  tagline: string;
  roiMinPct: number;
  roiMaxPct: number;
  durationDays: number;
  minAmount: number;
  maxAmount: number;
  accent: "brand" | "violet" | "cyan" | "warn";
  perks: string[];
  active: boolean;
}

export type InvestmentStatus = "active" | "completed" | "cancelled";

export interface Investment {
  id: string;
  userId: string;
  planId: string;
  amount: number;
  startedAt: string;
  status: InvestmentStatus;
  /** Total ROI % locked in at subscription, drawn from the plan's range. */
  roiPct: number;
  payoutCollected: number;
}

export type TxKind =
  | "deposit"
  | "withdrawal"
  | "investment"
  | "earning"
  | "referral"
  | "adjustment";

export type TxStatus = "pending" | "approved" | "rejected" | "completed";

export interface Transaction {
  id: string;
  userId: string;
  kind: TxKind;
  amount: number;
  status: TxStatus;
  method: string;
  reference: string;
  note: string;
  createdAt: string;
  resolvedAt: string | null;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  tone: "info" | "success" | "warning" | "danger";
  read: boolean;
  createdAt: string;
}

export interface Settings {
  platformName: string;
  supportEmail: string;
  minDeposit: number;
  minWithdrawal: number;
  withdrawalFeePct: number;
  referralCommissionPct: number;
  maintenanceMode: boolean;
  signupsOpen: boolean;
  wallets: { asset: string; network: string; address: string }[];
}

export interface DB {
  users: User[];
  plans: Plan[];
  investments: Investment[];
  transactions: Transaction[];
  notifications: Notification[];
  settings: Settings;
  sessionUserId: string | null;
}
