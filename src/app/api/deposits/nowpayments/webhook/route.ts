import { NextResponse, type NextRequest } from "next/server";
import { isPaymentStatus, type IpnBody, verifyIpnSignature } from "@/lib/nowpayments";
import { getAdminClient } from "@/lib/supabase/admin";

const UNIQUE_VIOLATION = "23505";

const num = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/**
 * Receives NOWPayments IPN callbacks. This is how a deposit learns that money arrived —
 * the browser is never told to file one, since it could lie about the amount.
 *
 * Crediting is still manual: this only files and annotates a *pending* transaction.
 */
export async function POST(request: NextRequest) {
  // Raw text rather than request.json(), because the body must be hashed in the form it
  // arrived before anything inside it is trusted.
  const raw = await request.text();

  let body: IpnBody;
  try {
    body = JSON.parse(raw) as IpnBody;
  } catch {
    console.error("NOWPayments IPN body was not JSON:", raw);
    return NextResponse.json({ error: "Malformed body." }, { status: 400 });
  }

  if (!verifyIpnSignature(body, request.headers.get("x-nowpayments-sig"))) {
    console.error("NOWPayments IPN signature rejected:", raw);
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  // Everything below is authenticated. Shapes we cannot act on get a 2xx so NOWPayments
  // treats the delivery as done instead of retrying something that will never succeed.
  const paymentId = body.payment_id == null ? "" : String(body.payment_id);
  if (!paymentId || !isPaymentStatus(body.payment_status)) {
    return NextResponse.json({ ok: true, ignored: "missing payment_id or unknown status" });
  }

  const status = body.payment_status;
  const actuallyPaid = num(body.actually_paid);
  const paidAtFiat = num(body.actually_paid_at_fiat);

  const admin = getAdminClient();

  // Claim the delivery before applying it. The key is content-based because the payload
  // carries no event id; see the ledger's comment in the migration for why the amount
  // is part of it.
  const claim = {
    payment_id: paymentId,
    payment_status: status,
    actually_paid: actuallyPaid ?? 0,
  };

  const { error: claimError } = await admin.from("nowpayments_webhook_events").insert(claim);

  if (claimError) {
    if (claimError.code === UNIQUE_VIOLATION) {
      return NextResponse.json({ ok: true, duplicate: `${paymentId}:${status}` });
    }
    console.error("Failed to claim NOWPayments IPN", claimError);
    return NextResponse.json({ error: "Could not record payment." }, { status: 500 });
  }

  const { data: outcome, error: applyError } = await admin.rpc("apply_nowpayments_ipn", {
    p_payment_id: paymentId,
    p_payment_status: status,
    p_actually_paid: actuallyPaid,
    p_actually_paid_at_fiat: paidAtFiat,
    p_payin_hash: body.payin_hash ?? null,
  });

  if (applyError) {
    // Release the claim, otherwise the dedupe above would swallow the retry and the
    // payment would never be filed.
    await admin
      .from("nowpayments_webhook_events")
      .delete()
      .match(claim);

    console.error(`Failed to apply NOWPayments IPN for ${paymentId}`, applyError);
    return NextResponse.json({ error: "Could not record payment." }, { status: 500 });
  }

  // A payment_id we never issued is not retryable, so it is acked. Loud, because it
  // means either a misdirected callback or a window we failed to record on creation.
  if (outcome === "unknown") {
    console.error(`NOWPayments IPN for unknown payment ${paymentId} (${status})`);
  }

  return NextResponse.json({ ok: true, outcome });
}
