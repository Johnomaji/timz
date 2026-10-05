import { NextResponse, type NextRequest } from "next/server";
import { mapDiditStatus, verifyWebhookSignature } from "@/lib/didit";
import { getAdminClient } from "@/lib/supabase/admin";

interface DiditWebhookBody {
  webhook_type?: string;
  session_id?: string;
  vendor_data?: string;
  status?: string;
}

/**
 * Receives Didit verification decisions. This is the authoritative source of a user's
 * KYC state: the browser callback only tells us the user came back, not what Didit ruled.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json()) as DiditWebhookBody;

  if (
    !verifyWebhookSignature(
      body as never,
      request.headers.get("x-signature-v2"),
      request.headers.get("x-timestamp"),
    )
  ) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 401 });
  }

  const userId = body.vendor_data;
  if (!userId || !body.status) {
    return NextResponse.json({ ok: true, ignored: "missing vendor_data or status" });
  }

  const kycStatus = mapDiditStatus(body.status);

  const { error } = await getAdminClient()
    .from("profiles")
    .update({
      kyc_status: kycStatus,
      kyc_session_id: body.session_id ?? null,
      kyc_updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) {
    // 5xx so Didit retries rather than treating a transient DB failure as delivered.
    console.error("Failed to persist Didit decision", error);
    return NextResponse.json({ error: "Could not record decision." }, { status: 500 });
  }

  if (kycStatus === "approved" || kycStatus === "declined") {
    await getAdminClient()
      .from("notifications")
      .insert({
        user_id: userId,
        title: kycStatus === "approved" ? "Identity verified" : "Verification unsuccessful",
        body:
          kycStatus === "approved"
            ? "Your identity has been confirmed. Your account is fully active."
            : "We could not verify your documents. You can try again from your settings.",
        tone: kycStatus === "approved" ? "success" : "danger",
      });
  }

  return NextResponse.json({ ok: true });
}
