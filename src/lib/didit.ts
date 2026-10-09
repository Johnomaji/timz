import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";
import type { KycStatus } from "./types";

const API_BASE = "https://verification.didit.me/v3";

/** Replay window Didit documents for webhook timestamps. */
const MAX_WEBHOOK_AGE_SECONDS = 300;

export const diditConfigured = Boolean(
  process.env.DIDIT_API_KEY && process.env.DIDIT_WORKFLOW_ID,
);

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set; identity verification is unavailable.`);
  return value;
}

export interface DiditSession {
  sessionId: string;
  url: string;
  status: string;
}

/**
 * Opens a hosted verification session. `vendorData` is echoed back on the webhook, which
 * is how an async decision gets matched to one of our users.
 */
export async function createVerificationSession(input: {
  vendorData: string;
  callbackUrl: string;
  email?: string;
  language?: string;
}): Promise<DiditSession> {
  const response = await fetch(`${API_BASE}/session/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": requireEnv("DIDIT_API_KEY"),
    },
    body: JSON.stringify({
      workflow_id: requireEnv("DIDIT_WORKFLOW_ID"),
      vendor_data: input.vendorData,
      callback: input.callbackUrl,
      language: input.language ?? "en",
      ...(input.email ? { contact_details: { email: input.email } } : {}),
    }),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Didit session creation failed (${response.status}): ${await response.text()}`);
  }

  const data = (await response.json()) as {
    session_id: string;
    url: string;
    status: string;
  };

  return { sessionId: data.session_id, url: data.url, status: data.status };
}

export async function fetchSessionDecision(sessionId: string): Promise<{ status: string }> {
  const response = await fetch(`${API_BASE}/session/${sessionId}/decision/`, {
    headers: { "x-api-key": requireEnv("DIDIT_API_KEY") },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Didit decision lookup failed (${response.status})`);
  }

  return (await response.json()) as { status: string };
}

export function mapDiditStatus(status: string): KycStatus {
  switch (status.trim().toLowerCase()) {
    case "approved":
      return "approved";
    case "declined":
      return "declined";
    case "in progress":
    case "in review":
    case "resubmitted":
      return "pending";
    default:
      // "Not Started", "Abandoned", "Expired", "KYC Expired" and any status Didit adds
      // later leave the user able to retry rather than stuck in a state the UI cannot
      // explain. An expired verification is not a rejection, so it is not 'declined'.
      return "unverified";
  }
}

/* ------------------------------ Webhook proof ------------------------------ */

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/**
 * Didit's V2 signature covers a canonical re-encoding of the body rather than the raw
 * bytes, so it survives proxies that reformat JSON. Reproducing it means sorting keys
 * recursively. Non-ASCII characters stay literal — JSON.stringify does not escape them.
 */
function canonicalize(value: Json): Json {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value !== null && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce<{ [key: string]: Json }>((acc, key) => {
        acc[key] = canonicalize(value[key] as Json);
        return acc;
      }, {});
  }
  return value;
}

function hmacHex(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload, "utf8").digest("hex");
}

function matchesConstantTime(expected: string, received: string): boolean {
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(received, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Proves the payload came from Didit. `raw` must be the untouched request text and
 * `parsed` its JSON.parse result — re-stringifying a parsed body loses the byte-exact
 * form that the X-Signature variant is computed over.
 *
 * X-Signature-Simple is deliberately unsupported: it only covers
 * timestamp:session_id:status:webhook_type, so a valid one would not authenticate the
 * decision object we read the verified country out of.
 */
export function verifyWebhookSignature(
  raw: string,
  parsed: unknown,
  signatureV2: string | null,
  signatureRaw: string | null,
): boolean {
  const secret = process.env.DIDIT_WEBHOOK_SECRET;
  if (!secret) return false;

  if (signatureV2) {
    return matchesConstantTime(
      hmacHex(secret, JSON.stringify(canonicalize(parsed as Json))),
      signatureV2,
    );
  }

  if (signatureRaw) {
    return matchesConstantTime(hmacHex(secret, raw), signatureRaw);
  }

  return false;
}

/**
 * Rejects replays. The timestamp has to come from the signed body: X-Timestamp sits
 * outside every signature, so an attacker could refresh that header on a captured
 * delivery and the HMAC would still check out.
 *
 * Only meaningful once verifyWebhookSignature has passed — on its own this proves
 * nothing, since an unsigned body can claim any timestamp.
 */
export function isWebhookFresh(timestamp: unknown): boolean {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) return false;
  return Math.abs(Math.floor(Date.now() / 1000) - timestamp) <= MAX_WEBHOOK_AGE_SECONDS;
}
