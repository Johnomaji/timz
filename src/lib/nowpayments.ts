import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

const API_BASE = "https://api.nowpayments.io/v1";

const PAYMENT_STATUSES = [
  "waiting",
  "confirming",
  "confirmed",
  "sending",
  "partially_paid",
  "finished",
  "failed",
  "refunded",
  "expired",
] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

/** Statuses NOWPayments never moves a payment out of. Mirrored in apply_nowpayments_ipn(). */
export const TERMINAL_STATUSES = ["finished", "failed", "refunded", "expired"] as const;

/** Guards the webhook: an unrecognised status must not be written to payment_status. */
export function isPaymentStatus(value: unknown): value is PaymentStatus {
  return PAYMENT_STATUSES.includes(value as PaymentStatus);
}

export const nowpaymentsConfigured = Boolean(
  process.env.NOWPAYMENTS_API_KEY && process.env.NOWPAYMENTS_IPN_SECRET,
);

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set; crypto checkout is unavailable.`);
  return value;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": requireEnv("NOWPAYMENTS_API_KEY"),
      ...init?.headers,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`NOWPayments ${path} failed (${response.status}): ${await response.text()}`);
  }

  return (await response.json()) as T;
}

/* -------------------------------- Payments -------------------------------- */

export interface NowPayment {
  paymentId: string;
  status: PaymentStatus;
  payAddress: string;
  payAmount: number;
  payCurrency: string;
  priceAmount: number;
  payinExtraId: string | null;
}

interface PaymentResponse {
  payment_id: number | string;
  payment_status: PaymentStatus;
  pay_address: string;
  pay_amount: number | string;
  pay_currency: string;
  price_amount: number | string;
  payin_extra_id?: string | null;
}

const toPayment = (data: PaymentResponse): NowPayment => ({
  // payment_id comes back as a number but is an identifier, not a quantity. Keeping it
  // as text avoids any float rounding on long ids.
  paymentId: String(data.payment_id),
  status: data.payment_status,
  payAddress: data.pay_address,
  payAmount: Number(data.pay_amount),
  payCurrency: data.pay_currency,
  priceAmount: Number(data.price_amount),
  payinExtraId: data.payin_extra_id ?? null,
});

/**
 * Opens a payment window and returns the address to send to. `orderId` is echoed back
 * on the IPN, but it is deliberately not what we match on — the payment_id is, because
 * it is assigned by NOWPayments and cannot be influenced by the caller.
 */
export async function createPayment(input: {
  priceAmount: number;
  payCurrency: string;
  orderId: string;
  orderDescription: string;
  ipnCallbackUrl: string;
}): Promise<NowPayment> {
  const data = await call<PaymentResponse>("/payment", {
    method: "POST",
    body: JSON.stringify({
      price_amount: input.priceAmount,
      price_currency: "usd",
      pay_currency: input.payCurrency,
      order_id: input.orderId,
      order_description: input.orderDescription,
      ipn_callback_url: input.ipnCallbackUrl,
    }),
  });

  return toPayment(data);
}

/**
 * Reads a payment's current state straight from NOWPayments. IPN is the primary signal;
 * this is the reconciliation path for a delivery that never arrived.
 */
export async function fetchPayment(paymentId: string): Promise<NowPayment> {
  return toPayment(await call<PaymentResponse>(`/payment/${encodeURIComponent(paymentId)}`));
}

/* ------------------------------- Currencies ------------------------------- */

/**
 * The coins enabled in the merchant account, so the UI never offers one that fails.
 *
 * Lower-cased because this endpoint answers in upper case while /payment and /min-amount
 * both want lower case — comparing the two forms directly rejects every coin.
 */
export async function fetchMerchantCoins(): Promise<string[]> {
  const data = await call<{ selectedCurrencies?: string[] }>("/merchant/coins");
  return (data.selectedCurrencies ?? []).map((coin) => coin.toLowerCase()).sort();
}

/**
 * Per-coin floor, in USD. Separate from settings.min_deposit and often higher: a BTC
 * payment has to clear the network's dust and fee thresholds regardless of our policy.
 */
export async function fetchMinAmount(payCurrency: string): Promise<number | null> {
  const params = new URLSearchParams({
    currency_from: payCurrency,
    currency_to: "usd",
    fiat_equivalent: "usd",
  });

  const data = await call<{ min_amount?: number | string; fiat_equivalent?: number | string }>(
    `/min-amount?${params}`,
  );

  const usd = data.fiat_equivalent ?? null;
  return usd === null ? null : Number(usd);
}

/* ------------------------------ Webhook proof ----------------------------- */

export interface IpnBody {
  payment_id?: number | string;
  payment_status?: PaymentStatus;
  pay_address?: string;
  price_amount?: number | string;
  price_currency?: string;
  pay_amount?: number | string;
  actually_paid?: number | string;
  actually_paid_at_fiat?: number | string;
  pay_currency?: string;
  order_id?: string | null;
  order_description?: string | null;
  purchase_id?: string | null;
  outcome_amount?: number | string;
  outcome_currency?: string;
  payin_hash?: string | null;
  fee?: Record<string, unknown>;
}

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/** Not shared with the identical helper in didit.ts: these track two vendors' specs, and
 * a change to one vendor's canonicalisation must not silently alter the other's. */
function sortDeep(value: Json): Json {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value !== null && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce<{ [key: string]: Json }>((acc, key) => {
        acc[key] = sortDeep(value[key] as Json);
        return acc;
      }, {});
  }
  return value;
}

function hmacHex(secret: string, payload: string): string {
  return createHmac("sha512", secret).update(payload, "utf8").digest("hex");
}

function matchesConstantTime(expected: string, received: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Proves the payload came from NOWPayments: HMAC-SHA512 over the key-sorted body,
 * compared against x-nowpayments-sig.
 *
 * Two encodings are accepted because NOWPayments' own examples disagree on nested
 * objects. Their PHP sample recursively ksorts and encodes the whole tree; their JS
 * sample passes the sorted *top-level* keys as JSON.stringify's array replacer, which
 * applies that list as a whitelist at every depth and so flattens the nested `fee`
 * object to `{}`. The two strings differ only when `fee` is present, which is exactly
 * when payments settle. Accepting either costs nothing: both are HMACs under the same
 * secret, so forging one is no easier than forging the other.
 */
export function verifyIpnSignature(parsed: unknown, signature: string | null): boolean {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (!secret || !signature) return false;

  const body = parsed as { [key: string]: Json };

  const recursive = JSON.stringify(sortDeep(body));
  const topLevelOnly = JSON.stringify(body, Object.keys(body).sort());

  return (
    matchesConstantTime(hmacHex(secret, recursive), signature) ||
    matchesConstantTime(hmacHex(secret, topLevelOnly), signature)
  );
}
