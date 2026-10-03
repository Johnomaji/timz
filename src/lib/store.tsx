"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  BASE_CURRENCY,
  FALLBACK_RATES,
  formatCurrency,
  isCurrencyCode,
  loadRates,
  type CurrencyCode,
  type Rates,
} from "./currency";
import { seedDb } from "./seed";
import type {
  DB,
  Investment,
  Notification,
  Plan,
  Settings,
  Transaction,
  User,
} from "./types";
import { daysBetween, uid } from "./utils";

const STORAGE_KEY = "apexvest.db.v5";

// Separate from STORAGE_KEY so resetDemoData() leaves the currency choice alone.
const CURRENCY_STORAGE_KEY = "apexvest.currency.v1";

/** Each subscription draws its own total-return rate from the plan's advertised range. */
function lockRoiPct(plan: Plan) {
  const span = plan.roiMaxPct - plan.roiMinPct;
  return Math.round((plan.roiMinPct + Math.random() * span) * 10) / 10;
}

export interface InvestmentView extends Investment {
  plan: Plan;
  elapsedDays: number;
  progress: number;
  accrued: number;
  projectedTotal: number;
  matured: boolean;
  daysRemaining: number;
  maturesAt: string;
}

interface StoreValue {
  db: DB;
  ready: boolean;
  currentUser: User | null;
  login: (email: string, password: string) => { ok: boolean; error?: string; user?: User };
  register: (input: {
    name: string;
    email: string;
    password: string;
    country: string;
    referralCode?: string;
  }) => { ok: boolean; error?: string; user?: User };
  logout: () => void;
  requestDeposit: (amount: number, method: string) => Transaction;
  requestWithdrawal: (amount: number, method: string, address: string) => { ok: boolean; error?: string };
  invest: (planId: string, amount: number) => { ok: boolean; error?: string };
  collectInvestment: (investmentId: string) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  updateProfile: (patch: Partial<Pick<User, "name" | "phone" | "country" | "twoFactor">>) => void;
  changePassword: (current: string, next: string) => { ok: boolean; error?: string };
  resolveTransaction: (id: string, decision: "approved" | "rejected", note?: string) => void;
  setUserStatus: (userId: string, status: User["status"]) => void;
  adjustBalance: (userId: string, delta: number, note: string) => void;
  savePlan: (plan: Plan) => void;
  deletePlan: (planId: string) => void;
  saveSettings: (settings: Settings) => void;
  resetDemoData: () => void;
  displayCurrency: CurrencyCode;
  setDisplayCurrency: (code: CurrencyCode) => void;
  rates: Rates;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [db, setDb] = useState<DB | null>(null);

  useEffect(() => {
    let loaded: DB | null = null;
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) loaded = JSON.parse(raw) as DB;
    } catch {
      loaded = null;
    }
    // Deliberately post-mount: reading localStorage during render would make the
    // first client render disagree with the server HTML and break hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDb(loaded ?? seedDb());
  }, []);

  useEffect(() => {
    if (!db) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch {
      // Storage full or unavailable — the in-memory demo still works.
    }
  }, [db]);

  const [displayCurrency, setCurrencyState] = useState<CurrencyCode>(BASE_CURRENCY);
  const [rates, setRates] = useState<Rates>(FALLBACK_RATES);

  useEffect(() => {
    let saved: string | null = null;
    try {
      saved = window.localStorage.getItem(CURRENCY_STORAGE_KEY);
    } catch {
      saved = null;
    }
    // Post-mount for the same hydration reason as the db read above.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (isCurrencyCode(saved)) setCurrencyState(saved);
  }, []);

  useEffect(() => {
    let active = true;
    loadRates().then((next) => {
      if (active) setRates(next);
    });
    return () => {
      active = false;
    };
  }, []);

  const setDisplayCurrency = useCallback((code: CurrencyCode) => {
    setCurrencyState(code);
    try {
      window.localStorage.setItem(CURRENCY_STORAGE_KEY, code);
    } catch {
      // Preference just won't survive a reload.
    }
  }, []);

  const currentUser = useMemo(
    () => db?.users.find((u) => u.id === db.sessionUserId) ?? null,
    [db],
  );

  const mutate = useCallback((fn: (draft: DB) => DB) => {
    setDb((prev) => (prev ? fn(structuredClone(prev)) : prev));
  }, []);

  const notify = (
    draft: DB,
    userId: string,
    title: string,
    body: string,
    tone: Notification["tone"],
  ) => {
    draft.notifications.unshift({
      id: uid("ntf"),
      userId,
      title,
      body,
      tone,
      read: false,
      createdAt: new Date().toISOString(),
    });
  };

  const pushTx = (draft: DB, tx: Omit<Transaction, "id">) => {
    const full: Transaction = { ...tx, id: uid("tx") };
    draft.transactions.unshift(full);
    return full;
  };

  const value = useMemo<StoreValue | null>(() => {
    if (!db) return null;

    return {
      db,
      ready: true,
      currentUser,

      login: (email, password) => {
        const user = db.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
        if (!user) return { ok: false, error: "No account found with that email." };
        if (user.password !== password) return { ok: false, error: "Incorrect password." };
        if (user.status === "suspended")
          return { ok: false, error: "This account is suspended. Contact support." };
        mutate((draft) => {
          draft.sessionUserId = user.id;
          const target = draft.users.find((u) => u.id === user.id);
          if (target) target.lastActiveAt = new Date().toISOString();
          return draft;
        });
        return { ok: true, user };
      },

      register: ({ name, email, password, country, referralCode }) => {
        if (!db.settings.signupsOpen)
          return { ok: false, error: "Registrations are temporarily closed." };
        if (db.users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase()))
          return { ok: false, error: "An account with that email already exists." };

        const referrer = referralCode
          ? db.users.find((u) => u.referralCode.toLowerCase() === referralCode.trim().toLowerCase())
          : undefined;

        const newUser: User = {
          id: uid("usr"),
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
          role: "user",
          status: "active",
          avatarHue: Math.floor(Math.random() * 360),
          balance: 0,
          country,
          phone: "",
          joinedAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString(),
          referralCode: `APEX-${name.slice(0, 2).toUpperCase()}${Math.floor(10 + Math.random() * 89)}`,
          referredBy: referrer?.id ?? null,
          twoFactor: false,
        };

        mutate((draft) => {
          draft.users.push(newUser);
          draft.sessionUserId = newUser.id;
          notify(
            draft,
            newUser.id,
            `Welcome to ${draft.settings.platformName}`,
            "Verify your identity and make your first deposit to activate a plan.",
            "info",
          );
          if (referrer) {
            notify(
              draft,
              referrer.id,
              "New referral signup",
              `${newUser.name} joined using your referral link.`,
              "success",
            );
          }
          return draft;
        });
        return { ok: true, user: newUser };
      },

      logout: () => mutate((draft) => ({ ...draft, sessionUserId: null })),

      requestDeposit: (amount, method) => {
        const tx: Transaction = {
          id: uid("tx"),
          userId: currentUser!.id,
          kind: "deposit",
          amount,
          status: "pending",
          method,
          reference: `DEP-${Math.floor(10_000 + Math.random() * 89_999)}`,
          note: "Awaiting admin confirmation",
          createdAt: new Date().toISOString(),
          resolvedAt: null,
        };
        mutate((draft) => {
          draft.transactions.unshift(tx);
          notify(
            draft,
            tx.userId,
            "Deposit submitted",
            `We received your ${method} deposit request. It will be credited once confirmed.`,
            "info",
          );
          return draft;
        });
        return tx;
      },

      requestWithdrawal: (amount, method, address) => {
        if (!currentUser) return { ok: false, error: "Not signed in." };
        if (amount < db.settings.minWithdrawal)
          return { ok: false, error: `Minimum withdrawal is $${db.settings.minWithdrawal}.` };
        const fee = (amount * db.settings.withdrawalFeePct) / 100;
        if (amount + fee > currentUser.balance)
          return { ok: false, error: "Amount plus fee exceeds your available balance." };

        mutate((draft) => {
          const user = draft.users.find((u) => u.id === currentUser.id)!;
          user.balance -= amount + fee;
          pushTx(draft, {
            userId: user.id,
            kind: "withdrawal",
            amount,
            status: "pending",
            method,
            reference: `WDR-${Math.floor(10_000 + Math.random() * 89_999)}`,
            note: `To ${address.slice(0, 10)}… · fee ${db.settings.withdrawalFeePct}%`,
            createdAt: new Date().toISOString(),
            resolvedAt: null,
          });
          notify(
            draft,
            user.id,
            "Withdrawal requested",
            `$${amount.toLocaleString()} is on hold pending admin approval.`,
            "warning",
          );
          return draft;
        });
        return { ok: true };
      },

      invest: (planId, amount) => {
        if (!currentUser) return { ok: false, error: "Not signed in." };
        const plan = db.plans.find((p) => p.id === planId);
        if (!plan || !plan.active) return { ok: false, error: "That plan is not available." };
        if (amount < plan.minAmount)
          return { ok: false, error: `Minimum for ${plan.name} is $${plan.minAmount.toLocaleString()}.` };
        if (amount > plan.maxAmount)
          return { ok: false, error: `Maximum for ${plan.name} is $${plan.maxAmount.toLocaleString()}.` };
        if (amount > currentUser.balance)
          return { ok: false, error: "Insufficient balance. Make a deposit first." };

        const roiPct = lockRoiPct(plan);

        mutate((draft) => {
          const user = draft.users.find((u) => u.id === currentUser.id)!;
          user.balance -= amount;
          draft.investments.push({
            id: uid("inv"),
            userId: user.id,
            planId,
            amount,
            startedAt: new Date().toISOString(),
            status: "active",
            roiPct,
            payoutCollected: 0,
          });
          pushTx(draft, {
            userId: user.id,
            kind: "investment",
            amount,
            status: "completed",
            method: "Account balance",
            reference: `INV-${Math.floor(10_000 + Math.random() * 89_999)}`,
            note: `${plan.name} plan subscription`,
            createdAt: new Date().toISOString(),
            resolvedAt: new Date().toISOString(),
          });
          notify(
            draft,
            user.id,
            `${plan.name} plan activated`,
            `Your $${amount.toLocaleString()} allocation is locked at ${roiPct}% over ${plan.durationDays} days.`,
            "success",
          );

          return draft;
        });
        return { ok: true };
      },

      collectInvestment: (investmentId) => {
        mutate((draft) => {
          const inv = draft.investments.find((i) => i.id === investmentId);
          if (!inv || inv.status !== "active") return draft;
          const plan = draft.plans.find((p) => p.id === inv.planId);
          if (!plan) return draft;
          const roi = (inv.amount * inv.roiPct) / 100;
          const user = draft.users.find((u) => u.id === inv.userId);
          if (!user) return draft;

          user.balance += inv.amount + roi;
          inv.status = "completed";
          inv.payoutCollected = roi;
          pushTx(draft, {
            userId: user.id,
            kind: "earning",
            amount: roi,
            status: "completed",
            method: `${plan.name} maturity`,
            reference: `ROI-${Math.floor(10_000 + Math.random() * 89_999)}`,
            note: `Principal $${inv.amount.toLocaleString()} returned with ROI`,
            createdAt: new Date().toISOString(),
            resolvedAt: new Date().toISOString(),
          });
          notify(
            draft,
            user.id,
            "Plan matured",
            `$${(inv.amount + roi).toLocaleString(undefined, { maximumFractionDigits: 2 })} was credited to your balance.`,
            "success",
          );

          if (user.referredBy) {
            const commission = (roi * draft.settings.referralCommissionPct) / 100;
            const referrer = draft.users.find((u) => u.id === user.referredBy);
            if (referrer) {
              referrer.balance += commission;
              pushTx(draft, {
                userId: referrer.id,
                kind: "referral",
                amount: commission,
                status: "completed",
                method: "Referral commission",
                reference: `REF-${Math.floor(10_000 + Math.random() * 89_999)}`,
                note: `${draft.settings.referralCommissionPct}% of ${user.name}'s ${plan.name} ROI`,
                createdAt: new Date().toISOString(),
                resolvedAt: new Date().toISOString(),
              });
              notify(
                draft,
                referrer.id,
                "Referral reward earned",
                `You earned $${commission.toFixed(2)} — ${draft.settings.referralCommissionPct}% of ${user.name}'s ROI.`,
                "success",
              );
            }
          }
          return draft;
        });
      },

      markNotificationRead: (id) =>
        mutate((draft) => {
          const n = draft.notifications.find((x) => x.id === id);
          if (n) n.read = true;
          return draft;
        }),

      markAllNotificationsRead: () =>
        mutate((draft) => {
          draft.notifications.forEach((n) => {
            if (n.userId === draft.sessionUserId) n.read = true;
          });
          return draft;
        }),

      updateProfile: (patch) =>
        mutate((draft) => {
          const user = draft.users.find((u) => u.id === draft.sessionUserId);
          if (user) Object.assign(user, patch);
          return draft;
        }),

      changePassword: (current, next) => {
        if (!currentUser) return { ok: false, error: "Not signed in." };
        if (currentUser.password !== current) return { ok: false, error: "Current password is wrong." };
        if (next.length < 6) return { ok: false, error: "Use at least 6 characters." };
        mutate((draft) => {
          const user = draft.users.find((u) => u.id === draft.sessionUserId);
          if (user) user.password = next;
          return draft;
        });
        return { ok: true };
      },

      resolveTransaction: (id, decision, note) =>
        mutate((draft) => {
          const tx = draft.transactions.find((t) => t.id === id);
          if (!tx || tx.status !== "pending") return draft;
          const user = draft.users.find((u) => u.id === tx.userId);
          if (!user) return draft;

          tx.status = decision;
          tx.resolvedAt = new Date().toISOString();
          if (note) tx.note = note;

          if (tx.kind === "deposit" && decision === "approved") {
            user.balance += tx.amount;
            notify(
              draft,
              user.id,
              "Deposit approved",
              `$${tx.amount.toLocaleString()} was credited to your available balance.`,
              "success",
            );
          } else if (tx.kind === "deposit") {
            notify(
              draft,
              user.id,
              "Deposit rejected",
              note || "We could not confirm this payment. Contact support.",
              "danger",
            );
          } else if (tx.kind === "withdrawal" && decision === "approved") {
            notify(
              draft,
              user.id,
              "Withdrawal sent",
              `$${tx.amount.toLocaleString()} was released to your wallet.`,
              "success",
            );
          } else if (tx.kind === "withdrawal") {
            const fee = (tx.amount * draft.settings.withdrawalFeePct) / 100;
            user.balance += tx.amount + fee;
            notify(
              draft,
              user.id,
              "Withdrawal rejected",
              note || "Your funds were returned to your available balance.",
              "danger",
            );
          }
          return draft;
        }),

      setUserStatus: (userId, status) =>
        mutate((draft) => {
          const user = draft.users.find((u) => u.id === userId);
          if (!user) return draft;
          user.status = status;
          notify(
            draft,
            user.id,
            status === "suspended" ? "Account suspended" : "Account reinstated",
            status === "suspended"
              ? "Your account was suspended by an administrator."
              : "Your account is active again.",
            status === "suspended" ? "danger" : "success",
          );
          return draft;
        }),

      adjustBalance: (userId, delta, note) =>
        mutate((draft) => {
          const user = draft.users.find((u) => u.id === userId);
          if (!user) return draft;
          user.balance = Math.max(0, user.balance + delta);
          pushTx(draft, {
            userId,
            kind: "adjustment",
            amount: Math.abs(delta),
            status: "completed",
            method: delta >= 0 ? "Admin credit" : "Admin debit",
            reference: `ADJ-${Math.floor(10_000 + Math.random() * 89_999)}`,
            note,
            createdAt: new Date().toISOString(),
            resolvedAt: new Date().toISOString(),
          });
          notify(
            draft,
            userId,
            delta >= 0 ? "Balance credited" : "Balance debited",
            `${note} · $${Math.abs(delta).toLocaleString()}`,
            delta >= 0 ? "success" : "warning",
          );
          return draft;
        }),

      savePlan: (plan) =>
        mutate((draft) => {
          const index = draft.plans.findIndex((p) => p.id === plan.id);
          if (index >= 0) draft.plans[index] = plan;
          else draft.plans.push(plan);
          return draft;
        }),

      deletePlan: (planId) =>
        mutate((draft) => ({ ...draft, plans: draft.plans.filter((p) => p.id !== planId) })),

      saveSettings: (settings) => mutate((draft) => ({ ...draft, settings })),

      resetDemoData: () => {
        const fresh = seedDb();
        setDb(fresh);
      },

      displayCurrency,
      setDisplayCurrency,
      rates,
    };
  }, [db, currentUser, mutate, displayCurrency, setDisplayCurrency, rates]);

  if (!value) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base">
        <div className="flex items-center gap-3 text-muted">
          <span className="size-2.5 animate-ring rounded-full bg-brand" />
          Loading ApexVest…
        </div>
      </div>
    );
  }

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}

/**
 * Formats a USD amount in the user's chosen display currency. Signature matches the
 * plain money() helper so call sites only change which function they call. Amounts are
 * stored in USD everywhere; conversion is presentation-only.
 */
export function useMoney() {
  const { displayCurrency, rates } = useStore();
  return useCallback(
    (value: number, opts?: { compact?: boolean; sign?: boolean }) =>
      formatCurrency(value, displayCurrency, rates, opts),
    [displayCurrency, rates],
  );
}

export function buildInvestmentView(inv: Investment, plans: Plan[]): InvestmentView | null {
  const plan = plans.find((p) => p.id === inv.planId);
  if (!plan) return null;
  const elapsedDays = Math.max(0, daysBetween(inv.startedAt));
  const cappedDays = Math.min(elapsedDays, plan.durationDays);
  const projectedTotal = (inv.amount * inv.roiPct) / 100;
  const accrued =
    inv.status === "active"
      ? (projectedTotal * cappedDays) / plan.durationDays
      : inv.payoutCollected;
  return {
    ...inv,
    plan,
    elapsedDays,
    progress: Math.min(100, (elapsedDays / plan.durationDays) * 100),
    accrued,
    projectedTotal,
    matured: elapsedDays >= plan.durationDays,
    daysRemaining: Math.max(0, Math.ceil(plan.durationDays - elapsedDays)),
    maturesAt: new Date(
      new Date(inv.startedAt).getTime() + plan.durationDays * 86_400_000,
    ).toISOString(),
  };
}

export function useUserInvestments(userId: string | undefined) {
  const { db } = useStore();
  return useMemo(() => {
    if (!userId) return [];
    return db.investments
      .filter((i) => i.userId === userId)
      .map((i) => buildInvestmentView(i, db.plans))
      .filter((i): i is InvestmentView => i !== null)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }, [db.investments, db.plans, userId]);
}
