import type {
  DB,
  Investment,
  KycSubmission,
  Notification,
  Plan,
  Transaction,
  User,
} from "./types";

export const DEMO_USER = { email: "user@apexvest.io", password: "user123" };
export const DEMO_ADMIN = { email: "admin@apexvest.io", password: "admin123" };

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const daysAgo = (days: number, hourOffset = 0) =>
  new Date(Date.now() - days * 86_400_000 - hourOffset * 3_600_000).toISOString();

export const PLANS: Plan[] = [
  {
    id: "plan_starter",
    name: "Starter",
    tagline: "Test the waters with a low entry point",
    dailyRate: 1.2,
    durationDays: 15,
    minAmount: 100,
    maxAmount: 2_500,
    accent: "cyan",
    perks: ["Daily ROI credited automatically", "Principal returned at maturity", "Email support"],
    active: true,
  },
  {
    id: "plan_growth",
    name: "Growth",
    tagline: "Our most popular balance of yield and term",
    dailyRate: 1.8,
    durationDays: 30,
    minAmount: 2_500,
    maxAmount: 15_000,
    accent: "brand",
    perks: [
      "Daily ROI credited automatically",
      "Principal returned at maturity",
      "Priority withdrawals",
      "Dedicated account manager",
    ],
    active: true,
  },
  {
    id: "plan_pro",
    name: "Pro Trader",
    tagline: "Higher allocation, compounding yield",
    dailyRate: 2.4,
    durationDays: 45,
    minAmount: 15_000,
    maxAmount: 75_000,
    accent: "violet",
    perks: [
      "Daily ROI credited automatically",
      "Principal returned at maturity",
      "Zero withdrawal fees",
      "Quarterly strategy calls",
    ],
    active: true,
  },
  {
    id: "plan_institutional",
    name: "Institutional",
    tagline: "Bespoke mandates for treasuries and funds",
    dailyRate: 3.1,
    durationDays: 60,
    minAmount: 75_000,
    maxAmount: 500_000,
    accent: "warn",
    perks: [
      "Daily ROI credited automatically",
      "Principal returned at maturity",
      "Zero withdrawal fees",
      "Segregated custody reporting",
      "24/7 desk access",
    ],
    active: true,
  },
];

const PEOPLE: [string, string, string][] = [
  ["Adaeze Okonkwo", "adaeze@example.com", "Nigeria"],
  ["Marcus Lindqvist", "marcus@example.com", "Sweden"],
  ["Priya Raghunathan", "priya@example.com", "India"],
  ["Tobias Brandt", "tobias@example.com", "Germany"],
  ["Sofia Marchetti", "sofia@example.com", "Italy"],
  ["Daniel Okafor", "daniel@example.com", "Nigeria"],
  ["Yuki Tanaka", "yuki@example.com", "Japan"],
  ["Elena Petrova", "elena@example.com", "Estonia"],
  ["Kwame Mensah", "kwame@example.com", "Ghana"],
];

const METHODS = ["USDT · TRC20", "BTC", "ETH", "USDC · ERC20"];

export function seedDb(): DB {
  const rand = mulberry32(20260923);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const between = (min: number, max: number) => Math.round((min + rand() * (max - min)) / 50) * 50;

  const admin: User = {
    id: "usr_admin",
    name: "Nadia Reyes",
    email: DEMO_ADMIN.email,
    password: DEMO_ADMIN.password,
    role: "admin",
    status: "active",
    avatarHue: 268,
    balance: 0,
    country: "Singapore",
    phone: "+65 8123 4477",
    joinedAt: daysAgo(420),
    lastActiveAt: daysAgo(0, 1),
    kycStatus: "verified",
    referralCode: "APEX-ADMIN",
    referredBy: null,
    twoFactor: true,
  };

  const primary: User = {
    id: "usr_demo",
    name: "James Whitfield",
    email: DEMO_USER.email,
    password: DEMO_USER.password,
    role: "user",
    status: "active",
    avatarHue: 158,
    balance: 18_420.5,
    country: "United Kingdom",
    phone: "+44 7700 900112",
    joinedAt: daysAgo(96),
    lastActiveAt: daysAgo(0),
    kycStatus: "verified",
    referralCode: "APEX-JW4Q",
    referredBy: null,
    twoFactor: false,
  };

  const users: User[] = [admin, primary];

  PEOPLE.forEach(([name, email, country], index) => {
    const kycRoll = rand();
    users.push({
      id: `usr_${index + 10}`,
      name,
      email,
      password: "user123",
      role: "user",
      status: index === 7 ? "suspended" : "active",
      avatarHue: Math.floor(rand() * 360),
      balance: between(400, 42_000),
      country,
      phone: `+1 ${Math.floor(200 + rand() * 700)} ${Math.floor(1000 + rand() * 8999)}`,
      joinedAt: daysAgo(Math.floor(6 + rand() * 300)),
      lastActiveAt: daysAgo(Math.floor(rand() * 9), Math.floor(rand() * 20)),
      kycStatus:
        kycRoll > 0.66 ? "verified" : kycRoll > 0.38 ? "pending" : kycRoll > 0.2 ? "unverified" : "rejected",
      referralCode: `APEX-${name.split(" ")[0]!.slice(0, 2).toUpperCase()}${Math.floor(10 + rand() * 89)}`,
      referredBy: index < 3 ? primary.id : null,
      twoFactor: rand() > 0.6,
    });
  });

  const investments: Investment[] = [];
  const transactions: Transaction[] = [];

  const addTx = (tx: Omit<Transaction, "id">) => {
    transactions.push({ ...tx, id: `tx_${transactions.length + 1000}` });
  };

  // Primary demo user gets a rich, readable history.
  const demoInvestments: [string, number, number][] = [
    ["plan_growth", 8_000, 12],
    ["plan_starter", 1_500, 5],
    ["plan_pro", 20_000, 38],
  ];

  demoInvestments.forEach(([planId, amount, age], i) => {
    const plan = PLANS.find((p) => p.id === planId)!;
    const matured = age >= plan.durationDays;
    investments.push({
      id: `inv_demo_${i}`,
      userId: primary.id,
      planId,
      amount,
      startedAt: daysAgo(age),
      status: matured ? "completed" : "active",
      payoutCollected: matured ? amount * (plan.dailyRate / 100) * plan.durationDays : 0,
    });
    addTx({
      userId: primary.id,
      kind: "investment",
      amount,
      status: "completed",
      method: "Account balance",
      reference: `INV-${4200 + i}`,
      note: `${plan.name} plan subscription`,
      createdAt: daysAgo(age),
      resolvedAt: daysAgo(age),
    });
  });

  [
    [12_000, 44, "approved"],
    [6_500, 30, "approved"],
    [15_000, 14, "approved"],
    [3_200, 2, "pending"],
  ].forEach(([amount, age, status], i) => {
    addTx({
      userId: primary.id,
      kind: "deposit",
      amount: amount as number,
      status: status as Transaction["status"],
      method: METHODS[i % METHODS.length]!,
      reference: `DEP-${8100 + i}`,
      note: status === "pending" ? "Awaiting network confirmation" : "Credited to balance",
      createdAt: daysAgo(age as number),
      resolvedAt: status === "pending" ? null : daysAgo((age as number) - 0.2),
    });
  });

  [
    [4_000, 21, "approved"],
    [1_800, 6, "pending"],
  ].forEach(([amount, age, status], i) => {
    addTx({
      userId: primary.id,
      kind: "withdrawal",
      amount: amount as number,
      status: status as Transaction["status"],
      method: "USDT · TRC20",
      reference: `WDR-${5300 + i}`,
      note: status === "pending" ? "Queued for admin review" : "Sent to wallet",
      createdAt: daysAgo(age as number),
      resolvedAt: status === "pending" ? null : daysAgo((age as number) - 0.4),
    });
  });

  for (let d = 26; d >= 1; d -= 1) {
    addTx({
      userId: primary.id,
      kind: "earning",
      amount: Math.round((110 + rand() * 260) * 100) / 100,
      status: "completed",
      method: "Daily ROI",
      reference: `ROI-${9000 + d}`,
      note: "Automated plan payout",
      createdAt: daysAgo(d, 4),
      resolvedAt: daysAgo(d, 4),
    });
  }

  users.slice(2, 5).forEach((u, i) => {
    addTx({
      userId: primary.id,
      kind: "referral",
      amount: Math.round((60 + rand() * 340) * 100) / 100,
      status: "completed",
      method: "Referral commission",
      reference: `REF-${7100 + i}`,
      note: `Commission from ${u.name}`,
      createdAt: daysAgo(Math.floor(3 + rand() * 40)),
      resolvedAt: daysAgo(Math.floor(3 + rand() * 40)),
    });
  });

  // Other users: a spread of activity, including pending items for the admin queues.
  users.slice(2).forEach((u, index) => {
    const plan = pick(PLANS);
    const age = Math.floor(rand() * plan.durationDays * 1.4);
    if (u.status === "active" && rand() > 0.25) {
      const amount = between(plan.minAmount, Math.min(plan.maxAmount, plan.minAmount * 4));
      investments.push({
        id: `inv_${index}`,
        userId: u.id,
        planId: plan.id,
        amount,
        startedAt: daysAgo(age),
        status: age >= plan.durationDays ? "completed" : "active",
        payoutCollected: age >= plan.durationDays ? amount * (plan.dailyRate / 100) * plan.durationDays : 0,
      });
    }

    addTx({
      userId: u.id,
      kind: "deposit",
      amount: between(300, 24_000),
      status: index % 3 === 0 ? "pending" : "approved",
      method: pick(METHODS),
      reference: `DEP-${9200 + index}`,
      note: index % 3 === 0 ? "Proof of payment uploaded" : "Credited to balance",
      createdAt: daysAgo(Math.floor(rand() * 20), Math.floor(rand() * 22)),
      resolvedAt: index % 3 === 0 ? null : daysAgo(Math.floor(rand() * 20)),
    });

    if (index % 2 === 0) {
      addTx({
        userId: u.id,
        kind: "withdrawal",
        amount: between(200, 9_000),
        status: index % 4 === 0 ? "pending" : "approved",
        method: pick(METHODS),
        reference: `WDR-${6400 + index}`,
        note: index % 4 === 0 ? "Queued for admin review" : "Sent to wallet",
        createdAt: daysAgo(Math.floor(rand() * 16), Math.floor(rand() * 22)),
        resolvedAt: index % 4 === 0 ? null : daysAgo(Math.floor(rand() * 16)),
      });
    }
  });

  const kyc: KycSubmission[] = users
    .filter((u) => u.role === "user" && (u.kycStatus === "pending" || u.kycStatus === "rejected"))
    .map((u, i) => ({
      id: `kyc_${i}`,
      userId: u.id,
      fullName: u.name,
      documentType: pick(["passport", "national_id", "drivers_license"] as const),
      documentNumber: `${u.country.slice(0, 2).toUpperCase()}${Math.floor(1_000_000 + rand() * 8_999_999)}`,
      fileName: `${u.name.split(" ")[0]!.toLowerCase()}-id-front.jpg`,
      fileSize: Math.floor(180_000 + rand() * 2_400_000),
      status: u.kycStatus === "rejected" ? "rejected" : "pending",
      submittedAt: daysAgo(Math.floor(1 + rand() * 12), Math.floor(rand() * 20)),
      reviewedAt: u.kycStatus === "rejected" ? daysAgo(Math.floor(rand() * 4)) : null,
      reviewNote: u.kycStatus === "rejected" ? "Document image was blurred and unreadable." : "",
    }));

  const notifications: Notification[] = [
    {
      id: "ntf_1",
      userId: primary.id,
      title: "Daily ROI credited",
      body: "Your Pro Trader plan paid out $480.00 into your available balance.",
      tone: "success",
      read: false,
      createdAt: daysAgo(0, 3),
    },
    {
      id: "ntf_2",
      userId: primary.id,
      title: "Deposit awaiting confirmation",
      body: "We detected your $3,200.00 deposit and are waiting on network confirmations.",
      tone: "info",
      read: false,
      createdAt: daysAgo(2),
    },
    {
      id: "ntf_3",
      userId: primary.id,
      title: "Withdrawal under review",
      body: "Your $1,800.00 withdrawal request is queued for admin approval.",
      tone: "warning",
      read: false,
      createdAt: daysAgo(6),
    },
    {
      id: "ntf_4",
      userId: primary.id,
      title: "Identity verified",
      body: "Your KYC documents were approved. All withdrawal limits are now lifted.",
      tone: "success",
      read: true,
      createdAt: daysAgo(40),
    },
    {
      id: "ntf_5",
      userId: admin.id,
      title: "4 items need review",
      body: "Pending deposits, withdrawals and KYC submissions are waiting in your queues.",
      tone: "warning",
      read: false,
      createdAt: daysAgo(0, 2),
    },
  ];

  return {
    users,
    plans: PLANS,
    investments,
    transactions: transactions.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    ),
    kyc,
    notifications,
    settings: {
      platformName: "ApexVest",
      supportEmail: "support@apexvest.io",
      minDeposit: 100,
      minWithdrawal: 50,
      withdrawalFeePct: 1.5,
      referralCommissionPct: 5,
      maintenanceMode: false,
      signupsOpen: true,
      wallets: [
        { asset: "USDT", network: "TRC20", address: "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE" },
        { asset: "BTC", network: "Bitcoin", address: "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq" },
        { asset: "ETH", network: "ERC20", address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F" },
      ],
    },
    sessionUserId: null,
  };
}
