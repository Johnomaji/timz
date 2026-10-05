import { NextResponse, type NextRequest } from "next/server";
import { createVerificationSession, diditConfigured } from "@/lib/didit";
import { getAdminClient } from "@/lib/supabase/admin";
import { getServerClient } from "@/lib/supabase/server";

/**
 * Starts a Didit verification for the signed-in user and hands back the hosted URL.
 *
 * The user id comes from the session cookie, never from the request body — otherwise
 * anyone could open a session against someone else's account and have the webhook
 * mark that account verified.
 */
export async function POST(request: NextRequest) {
  if (!diditConfigured) {
    return NextResponse.json(
      { error: "Identity verification is not configured on this environment." },
      { status: 503 },
    );
  }

  const supabase = await getServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sign in to start verification." }, { status: 401 });
  }

  try {
    const session = await createVerificationSession({
      vendorData: user.id,
      callbackUrl: new URL("/verify/complete", request.nextUrl.origin).toString(),
      email: user.email,
    });

    // Service role: a user may not write their own kyc columns, so RLS would block this.
    await getAdminClient()
      .from("profiles")
      .update({ kyc_session_id: session.sessionId, kyc_status: "pending" })
      .eq("id", user.id);

    return NextResponse.json({ url: session.url, sessionId: session.sessionId });
  } catch (error) {
    console.error("Didit session creation failed", error);
    return NextResponse.json({ error: "Could not start verification." }, { status: 502 });
  }
}
