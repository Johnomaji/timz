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
  country: string;
  phone?: string;
  referralCode?: string;
}): Promise<AuthResult> {
  const { data, error } = await getBrowserClient().auth.signUp({
    email: input.email.trim().toLowerCase(),
    password: input.password,
    // handle_new_user() reads these to build the profile and resolve referred_by.
    options: {
      data: {
        name: input.name.trim(),
        country: input.country,
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
