import { NextResponse, type NextRequest } from "next/server";
import { usingSupabase } from "@/lib/supabase/config";
import { getServerClient } from "@/lib/supabase/server";

/**
 * Turns an emailed auth link into a session cookie.
 *
 * Two shapes arrive here. The branded templates in `supabase/templates/` send
 * `token_hash`, which works even when the link is opened in a different browser from
 * the one that requested it. Supabase's stock templates send a PKCE `code`, which only
 * works in the originating browser because the verifier lives in a cookie there — both
 * are handled so the flow survives the templates being reset in the dashboard.
 */

const OTP_TYPES = ["signup", "invite", "magiclink", "recovery", "email_change", "email"] as const;
type OtpType = (typeof OTP_TYPES)[number];

const isOtpType = (value: string | null): value is OtpType =>
  OTP_TYPES.includes(value as OtpType);

/** Only in-app paths, so a crafted `next` can't bounce the user to another origin. */
const safeNext = (value: string | null) =>
  value && value.startsWith("/") && !value.startsWith("//") ? value : "/verify";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));

  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(reason)}`, origin));

  if (!usingSupabase) return fail("Email links are unavailable in demo mode.");

  const supabase = await getServerClient();
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");

  if (tokenHash && isOtpType(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (error) return fail("That link has expired. Request a new one.");
    return NextResponse.redirect(new URL(next, origin));
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return fail("That link has expired. Request a new one.");
    return NextResponse.redirect(new URL(next, origin));
  }

  return fail("That link is invalid or incomplete.");
}
