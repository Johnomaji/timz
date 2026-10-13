import type { Plan, Settings } from "./types";
import { pctRange } from "./utils";

export type ChatContext = {
  plans: Plan[];
  settings: Settings;
  money: (value: number) => string;
};

export type ChatLink = { label: string; href: string };

export type ChatEntry = {
  id: string;
  topic: string;
  question: string;
  /** One-word entries score per token; multi-word entries also match the raw query. */
  keywords: string[];
  answer: (ctx: ChatContext) => string;
  links?: ChatLink[];
};

const activePlans = (ctx: ChatContext) => ctx.plans.filter((p) => p.active);

const planLines = (ctx: ChatContext) =>
  activePlans(ctx)
    .map(
      (p) =>
        `• ${p.name} — ${p.durationDays} days, ${pctRange(p.roiMinPct, p.roiMaxPct)} total return`,
    )
    .join("\n");

const walletList = (ctx: ChatContext) =>
  ctx.settings.wallets.map((w) => `${w.asset} (${w.network})`).join(", ");

export const KNOWLEDGE: ChatEntry[] = [
  /* ------------------------------- The platform ------------------------------ */
  {
    id: "what-is-vestage",
    topic: "Getting started",
    question: "What is Vestage?",
    keywords: [
      "what is vestage",
      "what is this",
      "about",
      "platform",
      "company",
      "who are you",
      "explain",
      "overview",
    ],
    answer: (ctx) =>
      `${ctx.settings.platformName} is an investment platform. You fund your account in crypto, subscribe to a fixed-term plan, and collect your principal plus the return at the end of the term.\n\nCapital is deployed across diversified real-world assets and markets — established businesses, real estate, equities, commodities, forex, and emerging digital opportunities such as Web3.`,
    links: [
      { label: "See the plans", href: "/#plans" },
      { label: "How it works", href: "/#how" },
    ],
  },
  {
    id: "what-we-invest-in",
    topic: "Getting started",
    question: "What does the platform invest in?",
    keywords: [
      "invest in",
      "where does my money go",
      "assets",
      "portfolio",
      "strategy",
      "real estate",
      "property",
      "equities",
      "stocks",
      "commodities",
      "forex",
      "diversified",
      "diversification",
      "sectors",
    ],
    answer: () =>
      "We diversify across real-world assets and financial markets: established businesses, real estate and landed property, equities, commodities, forex, and emerging digital opportunities such as Web3.\n\nDifferent assets perform differently over time, so spreading capital across them is meant to reduce dependence on any single market.",
    links: [{ label: "Read the FAQ", href: "/#faq" }],
  },
  {
    id: "how-returns-generated",
    topic: "Getting started",
    question: "How are returns generated?",
    keywords: [
      "how are returns generated",
      "where do returns come from",
      "profit from",
      "revenue",
      "earn money",
      "sustainable",
      "dividends",
      "interest",
    ],
    answer: () =>
      "Returns can come from business growth, property appreciation and rental income, dividends, interest, trading opportunities, and broader market movements. The approach is long-term rather than dependent on a single trade or market.",
    links: [{ label: "Read the FAQ", href: "/#faq" }],
  },
  {
    id: "get-started",
    topic: "Getting started",
    question: "How do I get started?",
    keywords: [
      "get started",
      "sign up",
      "signup",
      "register",
      "create account",
      "open account",
      "join",
      "begin",
      "first step",
      "new",
    ],
    answer: (ctx) =>
      `Four steps:\n\n1. Create your account — email and password, under a minute.\n2. Complete identity verification. This is required before you can move any money.\n3. Fund your balance with crypto (${walletList(ctx)}).\n4. Subscribe to a plan and collect principal plus return at maturity.`,
    links: [
      { label: "Create an account", href: "/register" },
      { label: "Sign in", href: "/login" },
    ],
  },
  {
    id: "eligibility",
    topic: "Getting started",
    question: "Who can open an account?",
    keywords: [
      "who can",
      "eligible",
      "eligibility",
      "countries",
      "country",
      "my country",
      "available in",
      "allowed",
      "restricted",
      "age",
    ],
    answer: (ctx) =>
      `You need a valid government-issued ID that our verification provider can check, and you must pass that check before investing. If you are unsure whether your country or document type is supported, ask ${ctx.settings.supportEmail} before you deposit anything.`,
    links: [{ label: "Start verification", href: "/verify" }],
  },

  /* ----------------------------- Plans & returns ----------------------------- */
  {
    id: "plans",
    topic: "Plans & returns",
    question: "What investment plans are available?",
    keywords: [
      "plans",
      "plan",
      "terms",
      "options",
      "packages",
      "tiers",
      "rates",
      "roi",
      "return",
      "returns",
      "interest rate",
      "how much",
      "percentage",
      "duration",
      "term",
      "months",
    ],
    answer: (ctx) =>
      `There are ${activePlans(ctx).length} plans, each a flat rate with no variance:\n\n${planLines(ctx)}\n\nEvery percentage is the total return over the whole term — not per day and not per year. Your rate is locked to your subscription when you subscribe, so it never changes afterwards.`,
    links: [
      { label: "Compare plans", href: "/#plans" },
      { label: "Subscribe to a plan", href: "/dashboard/plans" },
    ],
  },
  {
    id: "rate-is-total",
    topic: "Plans & returns",
    question: "Is the rate daily or total?",
    keywords: [
      "daily",
      "per day",
      "a day",
      "compound",
      "compounding",
      "annual",
      "apy",
      "apr",
      "per year",
      "yearly",
      "monthly",
      "total return",
      "is the rate",
    ],
    answer: (ctx) => {
      const plan = activePlans(ctx)[0];
      const example = plan
        ? ` For example, ${plan.name} pays ${pctRange(plan.roiMinPct, plan.roiMaxPct)} across the full ${plan.durationDays} days — not ${pctRange(plan.roiMinPct, plan.roiMaxPct)} each day.`
        : "";
      return `Total over the term.${example}\n\nThere is no daily payout and no compounding. Your principal and the full return are paid together once the plan matures.`;
    },
  },
  {
    id: "amount-limits",
    topic: "Plans & returns",
    question: "What is the minimum and maximum investment?",
    keywords: [
      "minimum investment",
      "maximum investment",
      "min",
      "max",
      "limit",
      "limits",
      "smallest",
      "largest",
      "how little",
      "how much can i invest",
      "cap",
    ],
    answer: (ctx) => {
      const plan = activePlans(ctx)[0];
      if (!plan) return "Plan limits are not available right now.";
      return `${ctx.money(plan.minAmount)} to ${ctx.money(plan.maxAmount)} per investment, and the same range applies to every plan — there are no per-plan tiers.`;
    },
    links: [{ label: "Subscribe to a plan", href: "/dashboard/plans" }],
  },
  {
    id: "payout-example",
    topic: "Plans & returns",
    question: "How much will I earn?",
    keywords: [
      "how much will i earn",
      "how much do i get",
      "example",
      "calculate",
      "calculation",
      "payout",
      "profit",
      "earnings",
      "if i invest",
    ],
    answer: (ctx) => {
      const plan = activePlans(ctx)[1] ?? activePlans(ctx)[0];
      if (!plan) return "Plan details are not available right now.";
      const principal = 1000;
      const profit = (principal * plan.roiMinPct) / 100;
      return `Your return is the plan rate applied once to the amount you subscribe.\n\nSo ${ctx.money(principal)} on the ${plan.name} plan at ${plan.roiMinPct}% pays ${ctx.money(principal + profit)} at maturity — your ${ctx.money(principal)} principal back plus ${ctx.money(profit)} profit, after ${plan.durationDays} days.\n\nReturns are targets, not guarantees.`;
    },
    links: [{ label: "Compare plans", href: "/#plans" }],
  },
  {
    id: "maturity-collect",
    topic: "Plans & returns",
    question: "When do I get paid?",
    keywords: [
      "when do i get paid",
      "maturity",
      "mature",
      "matures",
      "collect",
      "payout date",
      "end of term",
      "finish",
      "complete",
      "ready",
    ],
    answer: () =>
      "When the term ends. Your plan shows a countdown on the dashboard; once it matures you collect it, and the principal plus the full return lands in your available balance. From there you can withdraw it or reinvest.",
    links: [
      { label: "My investments", href: "/dashboard/plans" },
      { label: "Dashboard", href: "/dashboard" },
    ],
  },
  {
    id: "early-exit",
    topic: "Plans & returns",
    question: "Can I withdraw before maturity?",
    keywords: [
      "early",
      "before maturity",
      "cancel",
      "cancel investment",
      "exit",
      "break",
      "unlock",
      "pull out",
      "change my mind",
      "locked",
    ],
    answer: (ctx) =>
      `An active plan runs to the end of its term — the amount is committed for the full duration and there is no early-exit button in the app. Only your available balance (money not currently in a plan) can be withdrawn at any time.\n\nIf you have a genuine problem, write to ${ctx.settings.supportEmail}.`,
  },
  {
    id: "multiple-investments",
    topic: "Plans & returns",
    question: "Can I run more than one plan at a time?",
    keywords: [
      "multiple",
      "more than one",
      "several",
      "two plans",
      "at the same time",
      "another plan",
      "additional",
    ],
    answer: () =>
      "Yes. You can hold as many plans at once as your balance allows, on any mix of terms, and each one keeps its own rate and maturity date.",
    links: [{ label: "Subscribe to a plan", href: "/dashboard/plans" }],
  },
  {
    id: "reinvest",
    topic: "Plans & returns",
    question: "Can I reinvest my returns?",
    keywords: ["reinvest", "roll over", "rollover", "compound again", "renew", "repeat"],
    answer: () =>
      "Yes. Collect the matured plan so the principal and return land in your available balance, then subscribe to a new plan with whatever amount you want. There is no automatic rollover, so nothing is reinvested without you choosing it.",
    links: [{ label: "Subscribe to a plan", href: "/dashboard/plans" }],
  },
  {
    id: "guarantees",
    topic: "Plans & returns",
    question: "Are returns guaranteed?",
    keywords: [
      "guaranteed",
      "guarantee",
      "risk",
      "risky",
      "lose",
      "loss",
      "safe investment",
      "certain",
      "promise",
      "scam",
    ],
    answer: () =>
      "No. No investment can honestly guarantee a return, and we do not claim to. Each plan quotes a target rate and we aim to hit it by managing risk and protecting capital, but it remains a target — your capital is at risk.",
    links: [{ label: "Read the FAQ", href: "/#faq" }],
  },

  /* -------------------------------- Deposits -------------------------------- */
  {
    id: "deposit-how",
    topic: "Deposits",
    question: "How do I deposit?",
    keywords: [
      "deposit",
      "fund",
      "funding",
      "add money",
      "top up",
      "topup",
      "pay in",
      "send money",
      "load",
    ],
    answer: (ctx) =>
      `Open Deposit on your dashboard and choose the asset you want to send. We show you an address for that deposit, you send the crypto, and your balance is credited once the payment clears and an administrator approves it.\n\nMinimum deposit is ${ctx.money(ctx.settings.minDeposit)}. Verification must be approved first.`,
    links: [{ label: "Deposit funds", href: "/dashboard/deposit" }],
  },
  {
    id: "assets",
    topic: "Deposits",
    question: "Which coins and networks can I use?",
    keywords: [
      "coins",
      "crypto",
      "currencies",
      "usdt",
      "btc",
      "bitcoin",
      "eth",
      "ethereum",
      "usdc",
      "trc20",
      "erc20",
      "network",
      "networks",
      "token",
      "which coin",
      "accept",
    ],
    answer: (ctx) =>
      `We support ${walletList(ctx)}. Always send on the exact network shown next to the address you are given — an asset sent on a different chain can be lost.\n\nThere are no fiat rails at all: no bank transfer, no wire, no card.`,
    links: [{ label: "Deposit funds", href: "/dashboard/deposit" }],
  },
  {
    id: "no-fiat",
    topic: "Deposits",
    question: "Can I pay by card or bank transfer?",
    keywords: [
      "card",
      "credit card",
      "debit",
      "bank",
      "bank transfer",
      "wire",
      "paypal",
      "fiat",
      "cash",
      "naira",
      "dollars",
      "sepa",
    ],
    answer: () =>
      "No. Deposits and withdrawals are crypto only — there is no card, bank transfer, wire or cash option anywhere on the platform. You would need to buy crypto elsewhere and send it to the address we give you.",
    links: [{ label: "Deposit funds", href: "/dashboard/deposit" }],
  },
  {
    id: "min-deposit",
    topic: "Deposits",
    question: "What is the minimum deposit?",
    keywords: ["minimum deposit", "least i can deposit", "smallest deposit", "min deposit"],
    answer: (ctx) =>
      `${ctx.money(ctx.settings.minDeposit)}. Note that the minimum to actually subscribe to a plan may be higher — check the plan limits before you send funds.`,
    links: [{ label: "Deposit funds", href: "/dashboard/deposit" }],
  },
  {
    id: "deposit-timing",
    topic: "Deposits",
    question: "How long does a deposit take to show up?",
    keywords: [
      "how long deposit",
      "deposit time",
      "confirmations",
      "confirm",
      "pending deposit",
      "waiting",
      "credited",
      "clear",
    ],
    answer: () =>
      "Two stages. First the blockchain has to confirm your transfer, which depends on the network and the fee you paid. Then an administrator reviews and credits it — every deposit passes through an approval queue, so nothing settles unnoticed. Until both are done the deposit sits as Pending in your history.",
    links: [{ label: "Transaction history", href: "/dashboard/transactions" }],
  },
  {
    id: "deposit-missing",
    topic: "Deposits",
    question: "My deposit has not arrived",
    keywords: [
      "not arrived",
      "not credited",
      "missing deposit",
      "where is my deposit",
      "not showing",
      "did not receive",
      "lost deposit",
      "stuck",
    ],
    answer: (ctx) =>
      `Check three things first: that the transaction is confirmed on-chain, that you sent the right asset on the right network, and that the amount is at least ${ctx.money(ctx.settings.minDeposit)}.\n\nIf all three are fine and it still has not been credited, email ${ctx.settings.supportEmail} with your transaction hash and the deposit reference from your history.`,
    links: [{ label: "Transaction history", href: "/dashboard/transactions" }],
  },
  {
    id: "wrong-network",
    topic: "Deposits",
    question: "I sent the wrong asset or used the wrong network",
    keywords: [
      "wrong network",
      "wrong asset",
      "wrong address",
      "wrong chain",
      "wrong coin",
      "bep20",
      "mistake",
      "sent to the wrong",
    ],
    answer: (ctx) =>
      `Stop and contact ${ctx.settings.supportEmail} straight away with the transaction hash, the asset and the network you used. Recovery is sometimes possible but it is never guaranteed — funds sent on an unsupported chain can be permanently lost. Do not send anything further to the same address.`,
  },

  /* ------------------------------- Withdrawals ------------------------------- */
  {
    id: "withdraw-how",
    topic: "Withdrawals",
    question: "How do I withdraw?",
    keywords: [
      "withdraw",
      "withdrawal",
      "cash out",
      "cashout",
      "take out",
      "payout to wallet",
      "get my money",
      "send to my wallet",
    ],
    answer: (ctx) =>
      `Open Withdraw on your dashboard, enter the amount, pick the asset and paste your own wallet address. The request goes into the admin review queue and the crypto is sent to your address once approved.\n\nMinimum is ${ctx.money(ctx.settings.minWithdrawal)} and there is a ${ctx.settings.withdrawalFeePct}% processing fee. Only your available balance can be withdrawn — money inside an active plan is locked until it matures.`,
    links: [{ label: "Withdraw funds", href: "/dashboard/withdraw" }],
  },
  {
    id: "withdraw-limits-fee",
    topic: "Withdrawals",
    question: "What is the withdrawal fee and minimum?",
    keywords: [
      "withdrawal fee",
      "minimum withdrawal",
      "min withdrawal",
      "how much to withdraw",
      "charge to withdraw",
    ],
    answer: (ctx) =>
      `Minimum withdrawal is ${ctx.money(ctx.settings.minWithdrawal)} and the processing fee is ${ctx.settings.withdrawalFeePct}% of the amount, shown on the form before you confirm. The fee is deducted on top of the amount you request, so check the summary line.`,
    links: [{ label: "Withdraw funds", href: "/dashboard/withdraw" }],
  },
  {
    id: "withdraw-timing",
    topic: "Withdrawals",
    question: "How long do withdrawals take?",
    keywords: [
      "how long withdrawal",
      "withdrawal time",
      "pending withdrawal",
      "review",
      "queue",
      "still pending",
      "approve",
    ],
    answer: () =>
      "Every withdrawal is reviewed by an administrator before any funds move, then broadcast to the network. It stays Pending in your history until it is approved and sent, and you get a notification when the status changes. Longer-term plans include priority withdrawals as a perk.",
    links: [{ label: "Transaction history", href: "/dashboard/transactions" }],
  },
  {
    id: "fees-overall",
    topic: "Withdrawals",
    question: "What fees do you charge?",
    keywords: [
      "fees",
      "fee",
      "charges",
      "cost",
      "commission",
      "hidden",
      "free",
      "how much do you take",
    ],
    answer: (ctx) =>
      `One platform fee: ${ctx.settings.withdrawalFeePct}% on withdrawals. There is no fee to deposit, no fee to subscribe to a plan, and no management fee on your balance.\n\nBlockchain network fees are separate and are charged by the network, not by us.`,
  },

  /* ------------------------------ Verification ------------------------------ */
  {
    id: "kyc-what",
    topic: "Verification",
    question: "Why do I have to verify my identity?",
    keywords: [
      "kyc",
      "verify",
      "verification",
      "identity",
      "id check",
      "why verify",
      "mandatory",
      "required",
      "skip verification",
    ],
    answer: () =>
      "Verification is mandatory and it gates the whole dashboard. Until it is approved you cannot deposit, invest or withdraw — the server rejects those actions, not just the buttons. It takes about two minutes and you only do it once.",
    links: [{ label: "Start verification", href: "/verify" }],
  },
  {
    id: "kyc-how",
    topic: "Verification",
    question: "How do I verify my account?",
    keywords: [
      "how do i verify",
      "how to verify",
      "documents",
      "document",
      "passport",
      "selfie",
      "liveness",
      "upload",
      "proof",
      "start verification",
    ],
    answer: () =>
      "Go to the verification page and you will be handed to our identity provider's hosted flow. You will need a government-issued ID and a quick selfie so it can match your face to the document. Have good lighting and the physical document to hand — photos of photocopies usually fail.",
    links: [{ label: "Start verification", href: "/verify" }],
  },
  {
    id: "kyc-pending",
    topic: "Verification",
    question: "My verification is still pending",
    keywords: [
      "pending verification",
      "still pending",
      "under review kyc",
      "waiting for verification",
      "how long verification",
      "how long kyc",
    ],
    answer: () =>
      "Most checks come back quickly, but some are referred for manual review. You do not need to resubmit or start a second check — that can slow things down. We notify you as soon as the result arrives, and the dashboard unlocks itself the moment it is approved.",
    links: [{ label: "Notifications", href: "/dashboard/notifications" }],
  },
  {
    id: "kyc-declined",
    topic: "Verification",
    question: "My verification was declined",
    keywords: [
      "declined",
      "rejected",
      "failed verification",
      "failed kyc",
      "denied",
      "not approved",
      "try again",
    ],
    answer: (ctx) =>
      `Declines are usually fixable — a blurry or cropped document, an expired ID, glare on the photo page, or a face that does not match clearly. Retry the check with the physical document in good light.\n\nIf it fails again, email ${ctx.settings.supportEmail} rather than retrying repeatedly.`,
    links: [{ label: "Retry verification", href: "/verify" }],
  },
  {
    id: "dashboard-locked",
    topic: "Verification",
    question: "Why is my dashboard greyed out?",
    keywords: [
      "greyed",
      "grayed",
      "grey",
      "locked dashboard",
      "cannot click",
      "can't click",
      "nothing works",
      "disabled",
      "blocked",
      "inert",
      "frozen",
    ],
    answer: () =>
      "Because your account is not verified yet. The real dashboard is shown behind the verification prompt so you can see what is there, but it is inactive until the check is approved. Settings and Notifications stay usable in the meantime, and everything unlocks automatically once you are verified.",
    links: [{ label: "Start verification", href: "/verify" }],
  },

  /* -------------------------------- Referrals ------------------------------- */
  {
    id: "referral-program",
    topic: "Referrals",
    question: "How does the referral program work?",
    keywords: [
      "referral",
      "referrals",
      "refer",
      "invite",
      "friend",
      "affiliate",
      "commission",
      "bonus",
    ],
    answer: (ctx) =>
      `You earn ${ctx.settings.referralCommissionPct}% of the ROI your referrals make — not ${ctx.settings.referralCommissionPct}% of what they deposit or invest. Share your referral link, and when someone who signed up through it collects a matured plan, your share of their profit is credited to you.`,
    links: [{ label: "My referrals", href: "/dashboard/referrals" }],
  },
  {
    id: "referral-link",
    topic: "Referrals",
    question: "Where is my referral link?",
    keywords: [
      "referral link",
      "referral code",
      "my code",
      "my link",
      "share link",
      "vest code",
      "where is my referral",
    ],
    answer: () =>
      "On the Referrals page in your dashboard. Every account gets a code prefixed with VEST- plus a ready-made link to copy, and that page also lists who has joined through you and what you have earned.",
    links: [{ label: "My referrals", href: "/dashboard/referrals" }],
  },
  {
    id: "referral-timing",
    topic: "Referrals",
    question: "When do I get paid for a referral?",
    keywords: [
      "when referral paid",
      "referral payout",
      "referral money",
      "referral reward",
      "referral when",
      "referral not paid",
      "no referral earnings",
      "paid",
      "payout",
    ],
    answer: (ctx) =>
      `At maturity, not at signup. The reward is ${ctx.settings.referralCommissionPct}% of realised ROI, so it is credited when your referral actually collects a matured plan — nothing is paid when they register, deposit, or subscribe. That is deliberate: no one gets paid on returns that have not happened yet.`,
    links: [{ label: "My referrals", href: "/dashboard/referrals" }],
  },

  /* --------------------------- Account & security --------------------------- */
  {
    id: "security",
    topic: "Account & security",
    question: "Is my money safe?",
    keywords: [
      "safe",
      "security",
      "secure",
      "custody",
      "protect",
      "hacked",
      "trust",
      "audit",
      "wallets",
    ],
    answer: () =>
      "The controls we can point to: deposits and withdrawals both pass an admin approval queue before funds move, wallets are segregated per asset with published addresses, every movement is recorded in a filterable ledger you can audit, and you can turn on two-factor authentication. Balances and privileges are changed server-side only, never from your browser.\n\nThat is operational security, not a guarantee against investment loss — the two are different things.",
    links: [{ label: "Security settings", href: "/dashboard/settings" }],
  },
  {
    id: "two-factor",
    topic: "Account & security",
    question: "How do I enable two-factor authentication?",
    keywords: ["2fa", "two factor", "two-factor", "authenticator", "otp", "mfa"],
    answer: () =>
      "In Settings, under Security, there is a two-factor authentication toggle. Turning it on is strongly recommended if you hold a balance.",
    links: [{ label: "Security settings", href: "/dashboard/settings" }],
  },
  {
    id: "password",
    topic: "Account & security",
    question: "How do I change or reset my password?",
    keywords: [
      "password",
      "change password",
      "reset password",
      "forgot",
      "forgot password",
      "locked out",
      "cannot log in",
      "can't log in",
      "cannot sign in",
    ],
    answer: () =>
      "If you are signed in, change it in Settings under Security — current password, then the new one twice. If you cannot get in at all, use the forgot-password link on the sign-in page and we will email you a reset link.",
    links: [
      { label: "Reset my password", href: "/forgot-password" },
      { label: "Security settings", href: "/dashboard/settings" },
    ],
  },
  {
    id: "profile",
    topic: "Account & security",
    question: "Can I change my email or personal details?",
    keywords: [
      "change email",
      "update details",
      "profile",
      "my name",
      "phone number",
      "change country",
      "edit account",
    ],
    answer: (ctx) =>
      `Your name, phone number and country are editable in Settings. Your email address is the identifier for the account and cannot be changed there — contact ${ctx.settings.supportEmail} if you need it moved.`,
    links: [{ label: "Settings", href: "/dashboard/settings" }],
  },
  {
    id: "account-suspended",
    topic: "Account & security",
    question: "My account is suspended",
    keywords: ["suspended", "banned", "frozen account", "disabled account", "restricted account"],
    answer: (ctx) =>
      `A suspended account cannot transact until it is reinstated. Email ${ctx.settings.supportEmail} from the address on the account and ask what is needed to lift it — the reason is not always something we can show in the app.`,
  },

  /* --------------------------- Money & reporting ---------------------------- */
  {
    id: "currency",
    topic: "Account & security",
    question: "Can I see amounts in my own currency?",
    keywords: [
      "currency",
      "my currency",
      "local currency",
      "exchange rate",
      "convert",
      "usd",
      "euro",
      "switch currency",
      "display",
    ],
    answer: () =>
      "Yes — use the currency switcher to pick your display currency and every amount on the site converts at live rates. It is presentation only: balances, plans and transactions are all held in USD underneath, so switching never changes what you actually own.",
  },
  {
    id: "transactions",
    topic: "Account & security",
    question: "Where can I see my transaction history?",
    keywords: [
      "history",
      "transactions",
      "statement",
      "ledger",
      "records",
      "receipts",
      "export",
      "activity",
    ],
    answer: () =>
      "The Transactions page in your dashboard lists everything in one filterable ledger — deposits, withdrawals, investments, earnings, referral rewards and any admin adjustment — each with a reference, status and timestamp.",
    links: [{ label: "Transaction history", href: "/dashboard/transactions" }],
  },
  {
    id: "taxes",
    topic: "Account & security",
    question: "What about tax?",
    keywords: ["tax", "taxes", "taxable", "hmrc", "irs", "report income", "accountant"],
    answer: () =>
      "We do not give tax advice and we do not file anything on your behalf — how returns are treated depends entirely on where you live. Your transaction history is the record to give your accountant.",
    links: [{ label: "Transaction history", href: "/dashboard/transactions" }],
  },
  {
    id: "notifications",
    topic: "Account & security",
    question: "Will I be notified when something happens?",
    keywords: ["notification", "notifications", "alerts", "email me", "updates", "notify"],
    answer: () =>
      "Yes. You get a notification when a plan matures, when a deposit is credited or still waiting on confirmations, when a withdrawal changes status, and when a referral reward is earned. They collect on the Notifications page.",
    links: [{ label: "Notifications", href: "/dashboard/notifications" }],
  },
  {
    id: "support",
    topic: "Account & security",
    question: "How do I contact a human?",
    keywords: [
      "support",
      "contact",
      "human",
      "agent",
      "help",
      "email you",
      "customer service",
      "speak to someone",
      "complaint",
    ],
    answer: (ctx) =>
      `Email ${ctx.settings.supportEmail} and include your account email plus any transaction reference involved — that gets you answered fastest. Longer-term plans also come with a dedicated account manager and, on the 1 Year plan, quarterly strategy calls.`,
  },
];

const TOPIC_ORDER = [
  "Getting started",
  "Plans & returns",
  "Deposits",
  "Withdrawals",
  "Verification",
  "Referrals",
  "Account & security",
];

export const TOPICS = TOPIC_ORDER.filter((topic) => KNOWLEDGE.some((e) => e.topic === topic));

export function entriesByTopic(topic: string) {
  return KNOWLEDGE.filter((entry) => entry.topic === topic);
}

export const STARTER_QUESTIONS = [
  "what-is-vestage",
  "plans",
  "get-started",
  "kyc-what",
  "deposit-how",
  "referral-program",
]
  .map((id) => KNOWLEDGE.find((entry) => entry.id === id))
  .filter((entry): entry is ChatEntry => Boolean(entry));

/* --------------------------------- Matching -------------------------------- */

const STOP_WORDS = new Set([
  "the", "and", "for", "are", "can", "you", "your", "with", "how", "what", "when", "where", "why",
  "who", "doe", "did", "will", "would", "should", "could", "have", "ha", "had", "wa", "were",
  "thi", "thes", "goe", "that", "there", "then", "than", "from", "into", "about", "it", "our",
  "but", "not",
  "any", "all", "get", "got", "please", "tell", "know", "want", "need", "like", "use", "using",
  "hello", "hey", "thank", "ye", "okay", "sure", "just", "now", "they", "them", "my", "me",
  "mine", "is", "be", "am", "of", "in", "on", "to", "at", "as", "an", "if", "so", "or", "up",
  "we", "us", "by", "no", "do", "give", "put", "take", "make", "see", "look",
]);

const normalize = (text: string) => text.toLowerCase().replace(/\s+/g, " ").trim();

/** Crude singular form so "plans"/"plan" and "fees"/"fee" score the same. */
function stem(word: string) {
  if (word.length > 4 && word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.length > 4 && word.endsWith("es") && !word.endsWith("ses")) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

/** Stem before dropping stop words, so "whats" reduces to "what" and gets dropped too. */
function tokenize(text: string) {
  return normalize(text)
    .replace(/[^a-z0-9% ]+/g, " ")
    .split(" ")
    .map(stem)
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

type Indexed = {
  entry: ChatEntry;
  phrases: string[];
  words: Set<string>;
  phraseWords: Set<string>;
  questionWords: Set<string>;
};

const INDEX: Indexed[] = KNOWLEDGE.map((entry) => {
  const phrases: string[] = [];
  const words = new Set<string>();
  const phraseWords = new Set<string>();

  for (const keyword of entry.keywords) {
    const tokens = tokenize(keyword);
    if (keyword.includes(" ") || tokens.length > 1) {
      phrases.push(normalize(keyword));
      for (const token of tokens) phraseWords.add(token);
    } else {
      for (const token of tokens) words.add(token);
    }
  }

  return { entry, phrases, words, phraseWords, questionWords: new Set(tokenize(entry.question)) };
});

const MIN_SCORE = 3;

function score(item: Indexed, query: string, tokens: string[]) {
  let total = 0;
  for (const phrase of item.phrases) {
    if (query.includes(phrase)) total += 5;
  }
  for (const token of tokens) {
    if (item.words.has(token)) total += 3;
    else if (item.phraseWords.has(token)) total += 2;
    else if (item.questionWords.has(token)) total += 1;
  }
  return total;
}

export type ChatMatch = { entry: ChatEntry; score: number };

/** Ranked matches for a free-text question, best first. Empty when nothing clears the bar. */
export function searchKnowledge(input: string, limit = 4): ChatMatch[] {
  const query = normalize(input);
  const tokens = tokenize(input);
  if (!query) return [];

  return INDEX.map((item) => ({ entry: item.entry, score: score(item, query, tokens) }))
    .filter((match) => match.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score || a.entry.question.length - b.entry.question.length)
    .slice(0, limit);
}

export const GREETING_PATTERN = /^(hi|hey|hello|yo|good (morning|afternoon|evening)|howdy)\b/i;

export const THANKS_PATTERN = /^(thanks|thank you|thx|ty|cheers|appreciate)\b/i;
