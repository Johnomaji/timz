export type Role = "user" | "admin";

export type UserStatus = "active" | "suspended";

export type KycStatus = "unverified" | "pending" | "verified" | "rejected";

export interface User {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  status: UserStatus;
  avatarHue: number;
  balance: number;
  country: string;
  phone: string;
  joinedAt: string;
  lastActiveAt: string;
  kycStatus: KycStatus;
  referralCode: string;
  referredBy: string | null;
  twoFactor: boolean;
}

export interface Plan {
  id: string;
  name: string;
  tagline: string;
  dailyRate: number;
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

export interface KycSubmission {
  id: string;
  userId: string;
  fullName: string;
  documentType: "passport" | "national_id" | "drivers_license";
  documentNumber: string;
  fileName: string;
  fileSize: number;
  status: KycStatus;
  submittedAt: string;
  reviewedAt: string | null;
  reviewNote: string;
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
  kyc: KycSubmission[];
  notifications: Notification[];
  settings: Settings;
  sessionUserId: string | null;
}
