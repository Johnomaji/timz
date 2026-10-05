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
  switch (status) {
    case "Approved":
      return "approved";
    case "Declined":
    case "Kyc Expired":
      return "declined";
    case "In Progress":
    case "In Review":
      return "pending";
    default:
      // "Not Started", "Abandoned" and any status Didit adds later leave the user
      // able to retry rather than stuck in a state the UI cannot explain.
      return "unverified";
  }
}

/* ------------------------------ Webhook proof ------------------------------ */

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/**
 * Didit signs a canonical re-encoding of the body rather than the raw bytes, so the
 * signature survives proxies that reformat JSON. Reproducing it means sorting keys
 * recursively and collapsing whole-valued floats back to integers.
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
  if (typeof value === "number" && !Number.isInteger(value) && value % 1 === 0) {
    return Math.trunc(value);
  }
  return value;
}

export function verifyWebhookSignature(
  body: Json,
  signature: string | null,
  timestamp: string | null,
): boolean {
  const secret = process.env.DIDIT_WEBHOOK_SECRET;
  if (!secret || !signature || !timestamp) return false;

  const sent = Number.parseInt(timestamp, 10);
  if (!Number.isFinite(sent)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - sent) > MAX_WEBHOOK_AGE_SECONDS) return false;

  const expected = createHmac("sha256", secret)
    .update(JSON.stringify(canonicalize(body)), "utf8")
    .digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
