import { NextResponse, type NextRequest } from "next/server";
import {
  createPayment,
  fetchMerchantCoins,
  fetchMinAmount,
  nowpaymentsConfigured,
} from "@/lib/nowpayments";
import { getAdminClient } from "@/lib/supabase/admin";
import { getServerClient } from "@/lib/supabase/server";

/** Windows older than this are treated as stale, so a repeat request opens a fresh one. */
const REUSE_WINDOW_MINUTES = 60;

const unconfigured = () =>
  NextResponse.json(
    { error: "Crypto checkout is not configured on this environment." },
    { status: 503 },
  );

/**
 * Coin list, or a single coin's USD floor when `?currency=` is given.
 *
 * Behind auth even though none of it is private: it spends our API key, and an open
 * endpoint would let anyone burn the rate limit.
 */
export async function GET(request: NextRequest) {
  if (!nowpaymentsConfigured) return unconfigured();

  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });

  const currency = request.nextUrl.searchParams.get("currency");

  try {
    if (currency) {
      return NextResponse.json({
        currency,
        minAmount: await fetchMinAmount(currency),
      });
    }

    return NextResponse.json({ coins: await fetchMerchantCoins() });
  } catch (error) {
    console.error("NOWPayments lookup failed", error);
    return NextResponse.json({ error: "Could not reach the payment provider." }, { status: 502 });
  }
}

/**
 * Opens a payment window for the signed-in user and returns the address to send to.
 *
 * The user id comes from the session cookie, never the body — otherwise anyone could
 * open a window against someone else's account and have the webhook credit it there.
 */
export async function POST(request: NextRequest) {
  if (!nowpaymentsConfigured) return unconfigured();

  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Sign in to deposit." }, { status: 401 });

  let body: { amount?: unknown; payCurrency?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }

  const amount = Number(body.amount);
  const payCurrency =
    typeof body.payCurrency === "string" ? body.payCurrency.trim().toLowerCase() : "";

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Enter a valid amount." }, { status: 400 });
  }

  if (!payCurrency) {
    return NextResponse.json({ error: "Choose a coin to pay with." }, { status: 400 });
  }

  const [settingsRes, profileRes] = await Promise.all([
    supabase.from("settings").select("min_deposit").single(),
    supabase.from("profiles").select("status,kyc_status").eq("id", user.id).maybeSingle(),
  ]);

  if (!settingsRes.data) {
    console.error("Could not read settings for a deposit", settingsRes.error);
    return NextResponse.json({ error: "Deposits are unavailable right now." }, { status: 503 });
  }

  // Re-checked here and not only in the browser: this is a public endpoint, so the
  // client-side check is just fast feedback. Same reasoning as the write RPCs.
  const minDeposit = Number(settingsRes.data.min_deposit);
  if (amount < minDeposit) {
    return NextResponse.json(
      { error: `Minimum deposit is $${minDeposit.toLocaleString()}.` },
      { status: 400 },
    );
  }

  if (profileRes.data?.status !== "active") {
    return NextResponse.json({ error: "Your account is not active." }, { status: 403 });
  }

  if (profileRes.data.kyc_status !== "approved") {
    return NextResponse.json(
      { error: "Verify your identity before depositing." },
      { status: 403 },
    );
  }

  try {
    const coins = await fetchMerchantCoins();
    if (!coins.includes(payCurrency)) {
      return NextResponse.json({ error: "That coin is not available." }, { status: 400 });
    }

    // Independent of our own minimum and frequently higher — a payment under the
    // network's own floor would be accepted here and then strand on-chain.
    const coinMin = await fetchMinAmount(payCurrency);
    if (coinMin !== null && amount < coinMin) {
      return NextResponse.json(
        {
          error: `${payCurrency.toUpperCase()} payments start at about $${Math.ceil(coinMin)}. Choose a larger amount or another coin.`,
        },
        { status: 400 },
      );
    }

    // Hand back the window the user already has rather than opening another. Without
    // this, re-submitting the form litters the provider and our table with dead
    // addresses, and the user could pay the wrong one.
    const since = new Date(Date.now() - REUSE_WINDOW_MINUTES * 60_000).toISOString();
    const { data: open } = await supabase
      .from("nowpayments_payments")
      .select("payment_id,pay_address,pay_amount,pay_currency,payin_extra_id,price_amount")
      .eq("user_id", user.id)
      .eq("pay_currency", payCurrency)
      .eq("price_amount", amount)
      .eq("payment_status", "waiting")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (open) {
      return NextResponse.json({
        paymentId: open.payment_id,
        payAddress: open.pay_address,
        payAmount: Number(open.pay_amount),
        payCurrency: open.pay_currency,
        payinExtraId: open.payin_extra_id,
        priceAmount: Number(open.price_amount),
        status: "waiting",
        reused: true,
      });
    }

    const payment = await createPayment({
      priceAmount: amount,
      payCurrency,
      orderId: `vestage-${crypto.randomUUID()}`,
      orderDescription: "Vestage account deposit",
      ipnCallbackUrl: new URL(
        "/api/deposits/nowpayments/webhook",
        request.nextUrl.origin,
      ).toString(),
    });

    // Service role: nowpayments_payments is read-only to the browser.
    const { error: insertError } = await getAdminClient().from("nowpayments_payments").insert({
      payment_id: payment.paymentId,
      user_id: user.id,
      payment_status: payment.status,
      price_amount: amount,
      pay_currency: payment.payCurrency,
      pay_amount: payment.payAmount,
      pay_address: payment.payAddress,
      payin_extra_id: payment.payinExtraId,
    });

    if (insertError) {
      // The window exists at the provider but we cannot match its IPN, so a payment to
      // this address would land as 'unknown'. Logged loudly because it needs a human.
      console.error(
        `ORPHANED NOWPayments payment ${payment.paymentId} for user ${user.id}`,
        insertError,
      );
      return NextResponse.json(
        { error: "Could not record that deposit. Do not send funds — contact support." },
        { status: 500 },
      );
    }

    return NextResponse.json({ ...payment, priceAmount: amount, reused: false });
  } catch (error) {
    console.error("NOWPayments payment creation failed", error);
    return NextResponse.json({ error: "Could not start that payment." }, { status: 502 });
  }
}
