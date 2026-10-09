-- Idempotency ledger for Didit webhook deliveries.
--
-- Didit retries a delivery twice on 5xx, so the same decision can arrive three times.
-- The primary key *is* the dedupe mechanism: the route claims an event_id here before
-- applying the decision, and a unique violation means an earlier delivery already won.
-- If applying then fails the route releases the claim, so the retry is not swallowed.
--
-- vendor_data is text rather than a reference to profiles on purpose: a bad or test
-- vendor_data must not fail this insert, or the delivery would 5xx and retry forever.
--
-- Service role only. RLS is on with no policies, so anon and authenticated are denied
-- even if someone later adds a GRANT by mistake.

create table public.kyc_webhook_events (
  event_id text primary key,
  session_id text,
  webhook_type text,
  status text,
  vendor_data text,
  received_at timestamptz not null default now()
);

alter table public.kyc_webhook_events enable row level security;

revoke all on public.kyc_webhook_events from anon, authenticated;

-- Supports pruning old rows; the ledger only needs to cover Didit's retry window.
create index kyc_webhook_events_received_idx on public.kyc_webhook_events (received_at desc);
