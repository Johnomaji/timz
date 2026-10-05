export type CurrencyCode =
  | "USD"
  | "EUR"
  | "GBP"
  | "NGN"
  | "JPY"
  | "CAD"
  | "AUD"
  | "INR"
  | "ZAR"
  | "AED"
  | "BRL"
  | "CNY";

export type Rates = Record<string, number>;

export const BASE_CURRENCY: CurrencyCode = "USD";

export const CURRENCIES: { code: CurrencyCode; label: string; locale: string }[] = [
  { code: "USD", label: "US Dollar", locale: "en-US" },
  { code: "EUR", label: "Euro", locale: "de-DE" },
  { code: "GBP", label: "British Pound", locale: "en-GB" },
  { code: "NGN", label: "Nigerian Naira", locale: "en-NG" },
  { code: "JPY", label: "Japanese Yen", locale: "ja-JP" },
  { code: "CAD", label: "Canadian Dollar", locale: "en-CA" },
  { code: "AUD", label: "Australian Dollar", locale: "en-AU" },
  { code: "INR", label: "Indian Rupee", locale: "en-IN" },
  { code: "ZAR", label: "South African Rand", locale: "en-ZA" },
  { code: "AED", label: "UAE Dirham", locale: "ar-AE" },
  { code: "BRL", label: "Brazilian Real", locale: "pt-BR" },
  { code: "CNY", label: "Chinese Yuan", locale: "zh-CN" },
];

const CURRENCY_BY_CODE = new Map(CURRENCIES.map((c) => [c.code, c]));

export function currencyMeta(code: string) {
  return CURRENCY_BY_CODE.get(code as CurrencyCode) ?? CURRENCIES[0];
}

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return typeof value === "string" && CURRENCY_BY_CODE.has(value as CurrencyCode);
}

const RATES_STORAGE_KEY = "vestage.fx.v1";
const ENDPOINT = "https://open.er-api.com/v6/latest/USD";

// The provider refreshes once a day, so anything fresher than this is a wasted request.
const MAX_AGE_MS = 12 * 60 * 60 * 1000;

export const FALLBACK_RATES: Rates = { USD: 1 };

type CachedRates = { fetchedAt: number; rates: Rates };

function readCache(): CachedRates | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(RATES_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedRates;
    if (typeof parsed?.fetchedAt !== "number" || typeof parsed?.rates?.USD !== "number") return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(entry: CachedRates) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RATES_STORAGE_KEY, JSON.stringify(entry));
  } catch {
    // Quota or private-mode failures are not worth surfacing; rates stay in memory.
  }
}

/**
 * Returns USD-based rates, preferring a cache entry under MAX_AGE_MS. A failed fetch
 * resolves to stale cache or USD-only rather than rejecting, so a network outage
 * degrades to dollar amounts instead of blanking every figure in the UI.
 */
export async function loadRates(): Promise<Rates> {
  const cached = readCache();
  if (cached && Date.now() - cached.fetchedAt < MAX_AGE_MS) return cached.rates;

  try {
    const res = await fetch(ENDPOINT);
    if (!res.ok) throw new Error(`FX request failed: ${res.status}`);

    const body = (await res.json()) as { result?: string; rates?: Rates };
    if (body.result !== "success" || !body.rates?.USD) throw new Error("FX payload malformed");

    const rates: Rates = { USD: 1 };
    for (const { code } of CURRENCIES) {
      const rate = body.rates[code];
      if (typeof rate === "number" && rate > 0) rates[code] = rate;
    }

    writeCache({ fetchedAt: Date.now(), rates });
    return rates;
  } catch {
    return cached?.rates ?? FALLBACK_RATES;
  }
}

export function convert(usdValue: number, code: string, rates: Rates) {
  return usdValue * (rates[code] ?? 1);
}

export function formatCurrency(
  usdValue: number,
  code: string,
  rates: Rates,
  opts?: { compact?: boolean; sign?: boolean },
) {
  const { locale } = currencyMeta(code);
  const converted = convert(usdValue, code, rates);
  const abs = Math.abs(converted);

  // Zero-decimal currencies would otherwise render as "¥1,234.00".
  const zeroDecimal = code === "JPY";
  const compact = Boolean(opts?.compact) && abs >= 10_000;

  const formatted = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: code,
    notation: compact ? "compact" : "standard",
    minimumFractionDigits: compact || zeroDecimal ? 0 : 2,
    maximumFractionDigits: compact ? 1 : zeroDecimal ? 0 : 2,
  }).format(abs);

  if (opts?.sign && converted !== 0) return `${converted > 0 ? "+" : "-"}${formatted}`;
  return converted < 0 ? `-${formatted}` : formatted;
}
