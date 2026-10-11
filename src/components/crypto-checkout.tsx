"use client";

import { AlertCircle, Check, Copy, Info, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge, type BadgeTone, Button, Field, Input, Select } from "@/components/ui";
import { getBrowserClient } from "@/lib/supabase/client";
import { usingSupabase } from "@/lib/supabase/config";
import { cn } from "@/lib/utils";

const ENDPOINT = "/api/deposits/nowpayments";

const POLL_MS = 8_000;

const TERMINAL = new Set(["finished", "failed", "refunded", "expired"]);

/** How the lifecycle reads to someone staring at an address they just paid. */
const STATUS_COPY: Record<string, { label: string; tone: BadgeTone; hint: string }> = {
  waiting: {
    label: "Awaiting payment",
    tone: "neutral",
    hint: "Send the exact amount below. This page updates on its own once the network sees it.",
  },
  confirming: {
    label: "Confirming",
    tone: "info",
    hint: "Your transfer has been seen and is waiting for network confirmations.",
  },
  confirmed: {
    label: "Confirmed",
    tone: "info",
    hint: "Confirmed on-chain. We are settling it with the payment provider.",
  },
  sending: {
    label: "Settling",
    tone: "info",
    hint: "Funds are being forwarded. Your deposit will be filed for approval shortly.",
  },
  partially_paid: {
    label: "Underpaid",
    tone: "warning",
    hint: "Less than the expected amount arrived. We will credit what was actually received.",
  },
  finished: {
    label: "Paid",
    tone: "success",
    hint: "Payment complete. Your deposit is pending approval and will be credited after review.",
  },
  failed: { label: "Failed", tone: "danger", hint: "The payment failed. Nothing was credited." },
  refunded: {
    label: "Refunded",
    tone: "danger",
    hint: "The payment was refunded. Nothing was credited.",
  },
  expired: {
    label: "Expired",
    tone: "neutral",
    hint: "This address is no longer valid. Start a new deposit to get a fresh one.",
  },
};

interface Window_ {
  paymentId: string;
  status: string;
  payAddress: string;
  payAmount: number;
  payCurrency: string;
  priceAmount: number;
  payinExtraId: string | null;
}

/** The payment window as the browser may read it back — RLS restricts this to own rows. */
const COLUMNS =
  "payment_id,payment_status,pay_address,pay_amount,pay_currency,payin_extra_id,price_amount";

interface Row {
  payment_id: string;
  payment_status: string;
  pay_address: string;
  pay_amount: number | string;
  pay_currency: string;
  payin_extra_id: string | null;
  price_amount: number | string;
}

const fromRow = (row: Row | null): Window_ | null =>
  row && {
    paymentId: row.payment_id,
    status: row.payment_status,
    payAddress: row.pay_address,
    payAmount: Number(row.pay_amount),
    payCurrency: row.pay_currency,
    priceAmount: Number(row.price_amount),
    payinExtraId: row.payin_extra_id,
  };

async function readOpenWindow(): Promise<Window_ | null> {
  const { data } = await getBrowserClient()
    .from("nowpayments_payments")
    .select(COLUMNS)
    .not("payment_status", "in", "(finished,failed,refunded,expired)")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return fromRow(data as Row | null);
}

async function readWindow(paymentId: string): Promise<Window_ | null> {
  const { data } = await getBrowserClient()
    .from("nowpayments_payments")
    .select(COLUMNS)
    .eq("payment_id", paymentId)
    .maybeSingle();

  return fromRow(data as Row | null);
}

export function CryptoCheckout({
  coins,
  minDeposit,
  money,
}: {
  coins: string[];
  minDeposit: number;
  money: (value: number, options?: { compact?: boolean }) => string;
}) {
  const [coin, setCoin] = useState(coins[0] ?? "");
  const [amount, setAmount] = useState("");
  const [window_, setWindow] = useState<Window_ | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<"address" | "amount" | "memo" | null>(null);

  // Both of these are tagged with what they describe rather than cleared when their
  // input changes, so a stale floor or QR can never be shown against a new selection.
  const [floorFor, setFloorFor] = useState<{ coin: string; min: number | null } | null>(null);
  const [qrFor, setQrFor] = useState<{ address: string; url: string } | null>(null);

  // Restore an address the user already has before showing them the form, so a reload
  // mid-payment does not look like the deposit vanished.
  const [restoring, setRestoring] = useState(usingSupabase);

  useEffect(() => {
    if (!usingSupabase) return;
    let live = true;

    void readOpenWindow().then((open) => {
      if (!live) return;
      if (open) setWindow(open);
      setRestoring(false);
    });

    return () => {
      live = false;
    };
  }, []);

  // The coin's own floor is independent of ours and frequently higher, so it has to be
  // on screen before the user commits to an amount.
  useEffect(() => {
    if (!coin) return;
    let live = true;

    fetch(`${ENDPOINT}?currency=${encodeURIComponent(coin)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((data: { minAmount?: number | null }) => {
        if (live) setFloorFor({ coin, min: data.minAmount ?? null });
      })
      .catch(() => {});

    return () => {
      live = false;
    };
  }, [coin]);

  const address = window_?.payAddress;

  // Only the address is encoded, not a payment URI: the scheme differs per chain and a
  // wrong one sends funds nowhere. Amount and memo are shown as text beside it.
  useEffect(() => {
    if (!address) return;
    let live = true;

    import("qrcode")
      .then((qrcode) =>
        qrcode.toDataURL(address, { margin: 1, width: 240, errorCorrectionLevel: "M" }),
      )
      .then((url) => live && setQrFor({ address, url }))
      .catch(() => {});

    return () => {
      live = false;
    };
  }, [address]);

  const paymentId = window_?.paymentId;
  const settled = window_ ? TERMINAL.has(window_.status) : false;

  const refresh = async () => {
    if (!paymentId || !usingSupabase) return;
    const current = await readWindow(paymentId);
    if (current) setWindow(current);
  };

  // The status only ever changes by webhook, so the browser has to go and look.
  useEffect(() => {
    if (!paymentId || settled || !usingSupabase) return;

    const id = setInterval(() => {
      void readWindow(paymentId).then((current) => current && setWindow(current));
    }, POLL_MS);

    return () => clearInterval(id);
  }, [paymentId, settled]);

  const coinMin = floorFor?.coin === coin ? floorFor.min : null;
  const qr = qrFor && qrFor.address === address ? qrFor.url : "";

  const copy = async (value: string, what: "address" | "amount" | "memo") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      setError("Clipboard is unavailable — copy the value manually.");
    }
  };

  const generate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    const value = Number(amount);
    if (!Number.isFinite(value) || value < minDeposit) {
      setError(`Minimum deposit is ${money(minDeposit)}.`);
      return;
    }
    if (!coin) {
      setError("Choose a coin to pay with.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const response = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: value, payCurrency: coin }),
      });

      const data = (await response.json()) as Window_ & { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Could not start that payment.");
        return;
      }

      setWindow({
        paymentId: data.paymentId,
        status: data.status,
        payAddress: data.payAddress,
        payAmount: Number(data.payAmount),
        payCurrency: data.payCurrency,
        priceAmount: Number(data.priceAmount),
        payinExtraId: data.payinExtraId ?? null,
      });
    } catch {
      setError("Could not reach the payment provider. Try again shortly.");
    } finally {
      setBusy(false);
    }
  };

  if (restoring) {
    return (
      <div className="flex items-center justify-center gap-2 px-5 py-14 text-sm text-muted">
        <Loader2 className="size-4 animate-spin" />
        Checking for an open payment…
      </div>
    );
  }

  if (window_) {
    const copy_ = STATUS_COPY[window_.status] ?? STATUS_COPY.waiting!;

    return (
      <div className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge tone={copy_.tone}>{copy_.label}</Badge>
          <div className="flex items-center gap-2">
            {!settled && (
              <Button variant="ghost" size="sm" onClick={() => void refresh()}>
                <RefreshCw className="size-3.5" />
                Refresh
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setWindow(null)}>
              New deposit
            </Button>
          </div>
        </div>

        <p className="mt-3 text-sm text-muted">{copy_.hint}</p>

        {!settled && (
          <div className="mt-5 flex flex-col gap-5 sm:flex-row">
            {qr && (
              /* eslint-disable-next-line @next/next/no-img-element -- a data: URL, nothing for the image optimiser to do */
              <img
                src={qr}
                alt={`QR code for the ${window_.payCurrency.toUpperCase()} deposit address`}
                className="size-30 shrink-0 self-center rounded-xl border border-line bg-white p-2 sm:self-start"
              />
            )}

            <div className="min-w-0 flex-1 space-y-3">
              <Row
                label={`Send exactly · ${window_.payCurrency.toUpperCase()}`}
                value={String(window_.payAmount)}
                copied={copied === "amount"}
                onCopy={() => void copy(String(window_.payAmount), "amount")}
              />
              <Row
                label="To this address"
                value={window_.payAddress}
                copied={copied === "address"}
                onCopy={() => void copy(window_.payAddress, "address")}
              />
              {window_.payinExtraId && (
                <Row
                  label="Memo / tag — required"
                  value={window_.payinExtraId}
                  copied={copied === "memo"}
                  onCopy={() => void copy(window_.payinExtraId!, "memo")}
                  danger
                />
              )}
            </div>
          </div>
        )}

        <div className="mt-5 space-y-2 rounded-xl border border-line bg-surface-2/50 p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Requested</span>
            <span className="font-mono text-ink">{money(window_.priceAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Reference</span>
            <span className="font-mono text-xs text-ink">{window_.paymentId}</span>
          </div>
        </div>

        {window_.payinExtraId && !settled && (
          <Callout tone="danger">
            This coin needs the memo above. A transfer sent without it cannot be matched to your
            account and may not be recoverable.
          </Callout>
        )}

        {!settled && (
          <Callout tone="info">
            The quoted {window_.payCurrency.toUpperCase()} amount holds for a limited time. Sending
            less files a smaller deposit; sending after the window expires may require support to
            recover.
          </Callout>
        )}

        {error && <Callout tone="danger">{error}</Callout>}
      </div>
    );
  }

  const floor = Math.max(minDeposit, coinMin === null ? 0 : Math.ceil(coinMin));

  return (
    <form className="p-5" onSubmit={generate}>
      <Field label="Pay with" hint={coins.length ? undefined : "Loading coins…"}>
        <Select value={coin} onChange={(e) => setCoin(e.target.value)} disabled={!coins.length}>
          {coins.map((c) => (
            <option key={c} value={c}>
              {c.toUpperCase()}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Amount (USD)"
        className="mt-4"
        hint={
          coinMin !== null && coinMin > minDeposit
            ? `${coin.toUpperCase()} payments start at about ${money(Math.ceil(coinMin))}`
            : `Minimum ${money(minDeposit)}`
        }
      >
        <Input
          type="number"
          min={floor}
          step="0.01"
          placeholder="1000.00"
          value={amount}
          onChange={(e) => {
            setAmount(e.target.value);
            setError("");
          }}
        />
      </Field>

      <div className="mt-4 flex flex-wrap gap-2">
        {[100, 1_000, 5_000, 25_000]
          .filter((preset) => preset >= floor)
          .map((preset) => (
            <button
              key={preset}
              type="button"
              onClick={() => setAmount(String(preset))}
              className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition-colors hover:border-brand/50 hover:text-brand"
            >
              {money(preset, { compact: true })}
            </button>
          ))}
      </div>

      {error && <Callout tone="danger">{error}</Callout>}

      <Callout tone="info">
        We generate an address that belongs to your deposit only, so there is nothing to tell us
        afterwards — the payment is matched automatically. An administrator still approves the
        credit.
      </Callout>

      <Button type="submit" className="mt-5 w-full" size="lg" disabled={busy || !coins.length}>
        {busy ? "Generating address…" : "Generate payment address"}
      </Button>
    </form>
  );
}

function Row({
  label,
  value,
  copied,
  onCopy,
  danger,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
  danger?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3.5",
        danger ? "border-danger/35 bg-danger/8" : "border-line bg-surface-2/50",
      )}
    >
      <p className={cn("text-xs", danger ? "text-danger" : "text-faint")}>{label}</p>
      <p className="mt-1.5 font-mono text-sm break-all text-ink">{value}</p>
      <Button variant="outline" size="sm" className="mt-2.5" onClick={onCopy}>
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

function Callout({ tone, children }: { tone: "info" | "danger"; children: React.ReactNode }) {
  const Icon = tone === "danger" ? AlertCircle : Info;

  return (
    <div
      className={cn(
        "mt-4 flex gap-2.5 rounded-xl border px-3.5 py-3 text-sm",
        tone === "danger"
          ? "border-danger/30 bg-danger/10 text-danger"
          : "border-info/25 bg-info/8 text-muted",
      )}
    >
      <Icon className={cn("mt-0.5 size-4 shrink-0", tone === "info" && "text-info")} />
      <p>{children}</p>
    </div>
  );
}
