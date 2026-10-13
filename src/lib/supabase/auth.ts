import type { User } from "@/lib/types";
import { getBrowserClient } from "./client";
import { PROFILE_COLUMNS, mapProfile, type ProfileRow } from "./mappers";

export interface AuthResult {
  ok: boolean;
  error?: string;
  user?: User;
  /** Supabase accepted the signup but withheld a session pending email confirmation. */
  needsEmailConfirmation?: boolean;
}

export async function fetchProfile(id: string): Promise<User | null> {
  const { data } = await getBrowserClient()
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", id)
    .maybeSingle();

  return data ? mapProfile(data as ProfileRow) : null;
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const supabase = getBrowserClient();

  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });

  if (error) return { ok: false, error: error.message };
  if (!data.user) return { ok: false, error: "Unable to sign in." };

  const profile = await fetchProfile(data.user.id);
  if (!profile) return { ok: false, error: "Your account has no profile. Contact support." };

  // Checked after sign-in rather than before because RLS denies anonymous reads of profiles.
  if (profile.status === "suspended") {
    await supabase.auth.signOut();
    return { ok: false, error: "This account is suspended. Contact support." };
  }

  await supabase
    .from("profiles")
    .update({ last_active_at: new Date().toISOString() })
    .eq("id", profile.id);

  return { ok: true, user: profile };
}

export async function signUp(input: {
  name: string;
  email: string;
  password: string;
  phone?: string;
  referralCode?: string;
}): Promise<AuthResult> {
  const { data, error } = await getBrowserClient().auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    // handle_new_user() reads these to build the profile and resolve referred_by.
    options: {
      // Must land on the route that exchanges the token for a session; pointing this at
      // the origin leaves the user confirmed but still signed out.
      emailRedirectTo: `${window.location.origin}/auth/confirm?next=/verify`,
      data: {
        name: input.name.trim(),
        phone: input.phone ?? "",
        referral_code: input.referralCode?.trim() ?? "",
      },
    },
  });

  if (error) return { ok: false, error: error.message };
  if (!data.user) return { ok: false, error: "Unable to create that account." };
  if (!data.session) return { ok: true, needsEmailConfirmation: true };

  const profile = await fetchProfile(data.user.id);
  return profile
    ? { ok: true, user: profile }
    : { ok: false, error: "Account created but the profile is missing. Contact support." };
}

export async function signOut(): Promise<void> {
  await getBrowserClient().auth.signOut();
}

/**
 * Sends the password-reset email.
 *
 * Callers must show the same confirmation whether or not the address exists — the result
 * deliberately carries no "unknown account" signal, so the form can't be used to work out
 * who banks here. Only transport-level failures surface as errors.
 */
export async function requestPasswordReset(email: string): Promise<AuthResult> {
  const { error } = await getBrowserClient().auth.resetPasswordForEmail(
    email.trim().toLowerCase(),
    { redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password` },
  );

  return error ? { ok: false, error: error.message } : { ok: true };
}

/**
 * Sets a new password for the recovery session created by the emailed link.
 *
 * Unlike `changePassword` in writes.ts this takes no current password — proving control of
 * the mailbox is the check, and someone resetting has by definition forgotten the old one.
 */
export async function completePasswordReset(password: string): Promise<AuthResult> {
  if (password.length < 6) return { ok: false, error: "Use at least 6 characters." };

  const supabase = getBrowserClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { ok: false, error: error.message };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Your reset link has expired. Request a new one." };

  const profile = await fetchProfile(user.id);
  return profile ? { ok: true, user: profile } : { ok: true };
}
