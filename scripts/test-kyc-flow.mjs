/**
 * End-to-end check of the mandatory-KYC gate.
 *
 * Creates a throwaway user, proves the money RPCs reject it while unverified, forges a
 * correctly-signed Didit webhook to approve it, then proves the same RPCs now succeed.
 *
 * What this CANNOT cover: Didit's hosted UI (a real document and selfie need a human),
 * and the greyed-out dashboard itself (needs eyes on a browser). Run with
 * `--keep --no-approve` to leave a signed-in-able unverified account for exactly that.
 *
 *   node scripts/test-kyc-flow.mjs                     # against localhost:3000
 *   node scripts/test-kyc-flow.mjs --base=https://...   # against a deployment
 *   node scripts/test-kyc-flow.mjs --keep --no-approve  # leave an unverified test user
 *
 * WRITES TO WHATEVER DATABASE .env.local POINTS AT. There is no separate test project,
 * so this creates and deletes real rows in the live Supabase instance.
 */

import { createHmac, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

/* ------------------------------- env + args ------------------------------- */

function loadEnv(path = ".env.local") {
  const out = {};
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    out[trimmed.slice(0, eq)] = trimmed.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return out;
}

const env = loadEnv();
const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name, fallback) =>
  args.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=") ?? fallback;

const BASE_URL = option("base", "http://localhost:3000").replace(/\/$/, "");
const KEEP = flag("keep");
const APPROVE = !flag("no-approve");

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const WEBHOOK_SECRET = env.DIDIT_WEBHOOK_SECRET;

for (const [name, value] of Object.entries({
  NEXT_PUBLIC_SUPABASE_URL: SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
  DIDIT_WEBHOOK_SECRET: WEBHOOK_SECRET,
})) {
  if (!value) {
    console.error(`Missing ${name} in .env.local — cannot run.`);
    process.exit(1);
  }
}

if (env.NEXT_PUBLIC_DATA_MODE === "demo") {
  console.error("NEXT_PUBLIC_DATA_MODE=demo is set. This script tests the live data path.");
  process.exit(1);
}

/* ------------------------------- assertions ------------------------------- */

let passed = 0;
const failures = [];

function check(label, ok, detail = "") {
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function step(label) {
  console.log(`\n${label}`);
}

/* --------------------------- webhook forging ------------------------------ */

/** Must match canonicalize() in src/lib/didit.ts or the HMAC will not line up. */
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = canonicalize(value[key]);
        return acc;
      }, {});
  }
  return value;
}

async function postWebhook(body, { signature } = {}) {
  const payload = JSON.stringify(body);
  const sig =
    signature ??
    createHmac("sha256", WEBHOOK_SECRET)
      .update(JSON.stringify(canonicalize(body)), "utf8")
      .digest("hex");

  const response = await fetch(`${BASE_URL}/api/kyc/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-signature-v2": sig },
    body: payload,
  });

  let json = null;
  try {
    json = await response.json();
  } catch {
    // Non-JSON error page; status alone is enough for the assertions below.
  }
  return { status: response.status, json };
}

function decisionBody(userId, status, overrides = {}) {
  return {
    event_id: randomUUID(),
    webhook_type: "status.updated",
    session_id: randomUUID(),
    session_kind: "id_verification",
    vendor_data: userId,
    status,
    timestamp: Math.floor(Date.now() / 1000),
    decision: { id_verifications: [{ issuing_state_name: "United Kingdom" }] },
    ...overrides,
  };
}

/* ---------------------------------- run ----------------------------------- */

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const email = `kyctest+${Date.now()}@example.com`;
const password = `Tv-${randomUUID().slice(0, 12)}`;
const forgedEventIds = [];
let userId = null;

async function profile() {
  const { data } = await admin
    .from("profiles")
    .select("kyc_status,balance,country,kyc_session_id")
    .eq("id", userId)
    .single();
  return data;
}

/** Resolves once the server-side reachability of BASE_URL is known. */
async function assertReachable() {
  step(`0. Target check`);
  console.log(`  Supabase : ${SUPABASE_URL}`);
  console.log(`  App      : ${BASE_URL}`);
  try {
    // An unsigned POST must be rejected — proves the route is live and enforcing.
    const response = await fetch(`${BASE_URL}/api/kyc/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hello: "world" }),
    });
    check("webhook route is live and rejects unsigned bodies", response.status === 401,
      `got ${response.status}`);
  } catch (error) {
    console.error(`\nCannot reach ${BASE_URL} — is the dev server running?`);
    console.error(String(error.message ?? error));
    process.exit(1);
  }
}

async function main() {
  await assertReachable();

  step("1. Create a confirmed, unverified user");
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name: "KYC Test" },
  });
  if (createError) throw new Error(`createUser failed: ${createError.message}`);
  userId = created.user.id;
  console.log(`  ${email}  /  ${password}`);
  console.log(`  id ${userId}`);

  const initial = await profile();
  check("handle_new_user created the profile row", Boolean(initial));
  check("new account starts unverified", initial?.kyc_status === "unverified",
    `kyc_status=${initial?.kyc_status}`);

  step("2. Sign in as the test user");
  const asUser = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { error: signInError } = await asUser.auth.signInWithPassword({ email, password });
  check("email-confirmed user can sign in", !signInError, signInError?.message);
  if (signInError) throw new Error("cannot continue without a session");

  const { data: settings } = await admin
    .from("settings")
    .select("min_deposit,min_withdrawal,withdrawal_fee_pct")
    .single();
  const { data: plan } = await admin
    .from("plans")
    .select("id,name,min_amount")
    .eq("active", true)
    .order("min_amount", { ascending: true })
    .limit(1)
    .single();
  console.log(`  min deposit $${settings.min_deposit} · plan "${plan.name}" from $${plan.min_amount}`);

  // Fund the account up front so the post-approval tests fail only on the KYC gate.
  const funding = Number(plan.min_amount) * 2 + Number(settings.min_withdrawal) * 2 + 100;
  await admin.from("profiles").update({ balance: funding }).eq("id", userId);

  const blocked = (error) => /verify your identity/i.test(error?.message ?? "");

  step("3. Money RPCs must REJECT an unverified user");
  const depositBlocked = await asUser.rpc("request_deposit", {
    p_amount: Number(settings.min_deposit),
    p_method: "USDT (TRC20)",
  });
  check("request_deposit rejected", blocked(depositBlocked.error),
    depositBlocked.error?.message ?? "no error raised");

  const investBlocked = await asUser.rpc("invest", {
    p_plan_id: plan.id,
    p_amount: Number(plan.min_amount),
  });
  check("invest rejected", blocked(investBlocked.error),
    investBlocked.error?.message ?? "no error raised");

  const withdrawBlocked = await asUser.rpc("request_withdrawal", {
    p_amount: Number(settings.min_withdrawal),
    p_method: "USDT (TRC20)",
    p_address: "TTestAddressForKycGateCheck",
  });
  check("request_withdrawal rejected", blocked(withdrawBlocked.error),
    withdrawBlocked.error?.message ?? "no error raised");

  const afterBlocked = await profile();
  check("balance untouched by the rejected calls", Number(afterBlocked.balance) === funding,
    `balance=${afterBlocked.balance}`);

  const { count: txCount } = await admin
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);
  check("no transaction rows were written", txCount === 0, `count=${txCount}`);

  step("4. Webhook rejects forgeries");
  const badSig = await postWebhook(decisionBody(userId, "Approved"), { signature: "deadbeef" });
  check("bad signature → 401", badSig.status === 401, `got ${badSig.status}`);

  const stale = decisionBody(userId, "Approved", {
    timestamp: Math.floor(Date.now() / 1000) - 600,
  });
  const staleResult = await postWebhook(stale);
  check("stale timestamp → 401", staleResult.status === 401, `got ${staleResult.status}`);

  const stillUnverified = await profile();
  check("forgeries did not change kyc_status", stillUnverified.kyc_status === "unverified",
    `kyc_status=${stillUnverified.kyc_status}`);

  if (!APPROVE) {
    step("Stopping before approval (--no-approve)");
    console.log(`  Sign in at ${BASE_URL}/login to see the greyed dashboard:`);
    console.log(`    ${email}`);
    console.log(`    ${password}`);
    return;
  }

  step("5. Approve via a correctly-signed webhook");
  const approval = decisionBody(userId, "Approved");
  forgedEventIds.push(approval.event_id);
  const approvalResult = await postWebhook(approval);
  check("signed webhook accepted", approvalResult.status === 200,
    `got ${approvalResult.status} ${JSON.stringify(approvalResult.json)}`);

  const approved = await profile();
  check("kyc_status flipped to approved", approved.kyc_status === "approved",
    `kyc_status=${approved.kyc_status}`);
  check("country back-filled from the document", approved.country === "United Kingdom",
    `country="${approved.country}"`);
  check("kyc_session_id recorded", approved.kyc_session_id === approval.session_id);

  const { data: notifications } = await admin
    .from("notifications")
    .select("title,tone")
    .eq("user_id", userId);
  check("'Identity verified' notification inserted",
    notifications.some((n) => n.title === "Identity verified"),
    JSON.stringify(notifications.map((n) => n.title)));

  step("6. Replay protection");
  const replay = await postWebhook(approval);
  check("duplicate event_id acked as duplicate",
    replay.status === 200 && replay.json?.duplicate === approval.event_id,
    JSON.stringify(replay.json));

  step("7. Money RPCs must now SUCCEED");
  const depositOk = await asUser.rpc("request_deposit", {
    p_amount: Number(settings.min_deposit),
    p_method: "USDT (TRC20)",
  });
  check("request_deposit accepted", !depositOk.error, depositOk.error?.message);

  const investOk = await asUser.rpc("invest", {
    p_plan_id: plan.id,
    p_amount: Number(plan.min_amount),
  });
  check("invest accepted", !investOk.error, investOk.error?.message);

  const withdrawOk = await asUser.rpc("request_withdrawal", {
    p_amount: Number(settings.min_withdrawal),
    p_method: "USDT (TRC20)",
    p_address: "TTestAddressForKycGateCheck",
  });
  check("request_withdrawal accepted", !withdrawOk.error, withdrawOk.error?.message);

  const { data: investments } = await admin
    .from("investments")
    .select("id,amount,roi_pct,status")
    .eq("user_id", userId);
  check("investment row created with a locked rate",
    investments.length === 1 && Number(investments[0].roi_pct) > 0,
    JSON.stringify(investments));

  step("8. Declined is handled too");
  const declined = decisionBody(userId, "Declined");
  forgedEventIds.push(declined.event_id);
  await postWebhook(declined);
  const afterDecline = await profile();
  check("kyc_status moved to declined", afterDecline.kyc_status === "declined",
    `kyc_status=${afterDecline.kyc_status}`);

  const redeposit = await asUser.rpc("request_deposit", {
    p_amount: Number(settings.min_deposit),
    p_method: "USDT (TRC20)",
  });
  check("a declined user is blocked again", blocked(redeposit.error),
    redeposit.error?.message ?? "no error raised");

  if (KEEP) {
    console.log(`\n  Keeping ${email} / ${password} (--keep)`);
  }
}

async function cleanup() {
  if (forgedEventIds.length > 0) {
    await admin.from("kyc_webhook_events").delete().in("event_id", forgedEventIds);
  }
  if (userId && !KEEP) {
    // Cascades through profiles → transactions / investments / notifications.
    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) console.error(`\nCleanup failed for ${userId}: ${error.message}`);
    else console.log(`\n  Removed test user ${email}`);
  }
}

main()
  .catch((error) => {
    failures.push(`threw: ${error.message}`);
    console.error(`\nAborted: ${error.stack ?? error.message}`);
  })
  .finally(async () => {
    await cleanup();
    console.log(`\n${passed} passed, ${failures.length} failed`);
    if (failures.length > 0) {
      for (const f of failures) console.log(`  - ${f}`);
    }
    process.exit(failures.length > 0 ? 1 : 0);
  });
