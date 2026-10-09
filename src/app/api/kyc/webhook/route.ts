import { NextResponse, type NextRequest } from "next/server";
import { isWebhookFresh, mapDiditStatus, verifyWebhookSignature } from "@/lib/didit";
import { getAdminClient } from "@/lib/supabase/admin";

/**
 * Session event families to subscribe this destination to in the Business Console.
 * The entity (user.*, business.*), activity and transaction families have nothing to
 * write to in this app, so they are acked and dropped rather than retried.
 */
const SESSION_EVENTS = new Set(["status.updated", "data.updated"]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const UNIQUE_VIOLATION = "23505";

interface DiditWebhookBody {
  event_id?: string;
  webhook_type?: string;
  session_id?: string;
  session_kind?: string;
  vendor_data?: string;
  status?: string;
  timestamp?: number;
  decision?: {
    /** V3 returns one array entry per workflow node; older payloads sent a single object. */
    id_verifications?: { issuing_state_name?: string }[];
    id_verification?: { issuing_state_name?: string };
  };
}

/**
 * Receives Didit verification decisions. This is the authoritative source of a user's
 * KYC state: the browser callback only tells us the user came back, not what Didit ruled.
 */
export async function POST(request: NextRequest) {
  // Raw text rather than request.json(), because the body must be hashed in the form it
  // arrived before anything inside it is trusted.
  const raw = await request.text();

  let body: DiditWebhookBody;
  try {
    body = JSON.parse(raw) as DiditWebhookBody;
  } catch {
    console.error("Didit webhook body was not JSON:", raw);
    return NextResponse.json({ error: "Malformed body." }, { status: 400 });
  }

  const signed = verifyWebhookSignature(
    raw,
    body,
    request.headers.get("x-signature-v2"),
    request.headers.get("x-signature"),
  );

  if (!signed) {
    console.error("Didit webhook signature rejected:", raw);
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  if (!isWebhookFresh(body.timestamp)) {
    return NextResponse.json({ error: "Stale webhook." }, { status: 401 });
  }

  // Everything below is authenticated. Unhandled shapes get a 2xx so Didit treats the
  // delivery as done instead of burning its two retries on it.
  if (!SESSION_EVENTS.has(body.webhook_type ?? "")) {
    return NextResponse.json({ ok: true, ignored: body.webhook_type ?? "unknown type" });
  }

  if (body.session_kind === "business") {
    return NextResponse.json({ ok: true, ignored: "business session" });
  }

  const userId = body.vendor_data;
  if (!userId || !body.status) {
    return NextResponse.json({ ok: true, ignored: "missing vendor_data or status" });
  }

  // Console test webhooks send a placeholder vendor_data. Without this guard it reaches
  // Postgres as an invalid uuid, which would 500 and trigger pointless retries.
  if (!UUID.test(userId)) {
    return NextResponse.json({ ok: true, ignored: "vendor_data is not a user id" });
  }

  const admin = getAdminClient();

  // Claim the delivery before applying it. Falling back to the session/type/status
  // triple keeps the key single-column, so the primary key stays the atomic guard.
  const eventId =
    body.event_id ?? `${body.session_id}:${body.webhook_type}:${body.status}`;

  const { error: claimError } = await admin.from("kyc_webhook_events").insert({
    event_id: eventId,
    session_id: body.session_id ?? null,
    webhook_type: body.webhook_type,
    status: body.status,
    vendor_data: userId,
  });

  if (claimError) {
    if (claimError.code === UNIQUE_VIOLATION) {
      return NextResponse.json({ ok: true, duplicate: eventId });
    }
    console.error("Failed to claim Didit event", claimError);
    return NextResponse.json({ error: "Could not record decision." }, { status: 500 });
  }

  const applied = await applyDecision(userId, body);

  if (!applied) {
    // Release the claim, otherwise the dedupe above would swallow Didit's retry and the
    // decision would be lost for good.
    await admin.from("kyc_webhook_events").delete().eq("event_id", eventId);
    return NextResponse.json({ error: "Could not record decision." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/** Returns false on a transient failure, which the caller turns into a retryable 5xx. */
async function applyDecision(userId: string, body: DiditWebhookBody): Promise<boolean> {
  const admin = getAdminClient();
  const kycStatus = mapDiditStatus(body.status as string);

  const { data: existing, error: readError } = await admin
    .from("profiles")
    .select("kyc_status")
    .eq("id", userId)
    .maybeSingle();

  if (readError) {
    console.error("Failed to read profile for Didit decision", readError);
    return false;
  }

  // An unknown vendor_data is not retryable — nothing will make the row appear.
  if (!existing) return true;

  // Signup no longer asks for a country; the issuing state on the verified document is
  // where it comes from. Only written on approval, and never blanked out.
  const country = (
    body.decision?.id_verifications?.[0]?.issuing_state_name ??
    body.decision?.id_verification?.issuing_state_name
  )?.trim();

  const { error: updateError } = await admin
    .from("profiles")
    .update({
      kyc_status: kycStatus,
      kyc_session_id: body.session_id ?? null,
      kyc_updated_at: new Date().toISOString(),
      ...(kycStatus === "approved" && country ? { country } : {}),
    })
    .eq("id", userId);

  if (updateError) {
    console.error("Failed to persist Didit decision", updateError);
    return false;
  }

  // data.updated can repeat a status we already told the user about, so only announce a
  // real transition.
  const changed = existing.kyc_status !== kycStatus;

  if (changed && (kycStatus === "approved" || kycStatus === "declined")) {
    const { error: notifyError } = await admin.from("notifications").insert({
      user_id: userId,
      title: kycStatus === "approved" ? "Identity verified" : "Verification unsuccessful",
      body:
        kycStatus === "approved"
          ? "Your identity has been confirmed. Your account is fully active."
          : "We could not verify your documents. You can try again from your settings.",
      tone: kycStatus === "approved" ? "success" : "danger",
    });

    // The decision is already saved; a failed notification must not replay the event.
    if (notifyError) console.error("Failed to notify Didit decision", notifyError);
  }

  return true;
}
