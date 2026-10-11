-- NOWPayments crypto deposits.
--
-- The manual deposit path (send to a wallet in settings.wallets, then file a notice)
-- stays exactly as it was. This adds a second path where NOWPayments generates a
-- per-deposit address and tells us over IPN when funds arrive.
--
-- Crediting is deliberately still manual: the webhook only files and annotates a
-- *pending* transaction, and the existing resolve_transaction() is what moves money.
-- So a bug in the webhook can mis-state a deposit, but it cannot pay anyone out.

-- Payment windows -----------------------------------------------------------
-- One row per generated address. transaction_id is null until money is actually
-- detected: a user who opens the deposit page, generates an address and walks away
-- must not leave a pending deposit sitting in the admin approval queue.
create table public.nowpayments_payments (
  payment_id text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  transaction_id uuid unique references public.transactions (id) on delete set null,
  payment_status text not null default 'waiting',
  -- What the user asked to deposit, in USD. The authoritative figure until an IPN
  -- reports what really landed.
  price_amount numeric(18, 2) not null check (price_amount > 0),
  pay_currency text not null,
  -- Crypto amounts need far more scale than money: 1 sat is 0.00000001 BTC, and
  -- 18 decimals is the ERC-20 norm.
  pay_amount numeric(36, 18) not null,
  pay_address text not null,
  -- Memo/tag for chains that need one (XRP, XLM…). Losing this loses the deposit.
  payin_extra_id text,
  actually_paid numeric(36, 18),
  actually_paid_at_fiat numeric(18, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index nowpayments_payments_user_idx
  on public.nowpayments_payments (user_id, created_at desc);

-- Supports the deposit page's "do I have an address already?" lookup.
create index nowpayments_payments_open_idx
  on public.nowpayments_payments (user_id, created_at desc)
  where payment_status not in ('finished', 'failed', 'refunded', 'expired');

alter table public.nowpayments_payments enable row level security;

-- Read-only to the browser. Every write happens under the service role, matching the
-- rule in the RLS migration that the browser may never move money.
revoke all on public.nowpayments_payments from anon, authenticated;
grant select on public.nowpayments_payments to authenticated;

create policy "nowpayments: read own"
  on public.nowpayments_payments for select
  to authenticated
  using (user_id = auth.uid());

create policy "nowpayments: admins read all"
  on public.nowpayments_payments for select
  to authenticated
  using (public.is_admin());

-- Idempotency ledger --------------------------------------------------------
-- NOWPayments sends no event id, so the key is built from the delivery's content.
--
-- Keying on payment_id alone would be wrong: a payer can top up an underpaid deposit,
-- which legitimately re-sends partially_paid with a larger actually_paid, and that
-- second delivery must still apply. Including the amount dedupes exact redeliveries
-- while letting real progress through.
create table public.nowpayments_webhook_events (
  payment_id text not null,
  payment_status text not null,
  actually_paid numeric(36, 18) not null default 0,
  received_at timestamptz not null default now(),
  primary key (payment_id, payment_status, actually_paid)
);

alter table public.nowpayments_webhook_events enable row level security;

revoke all on public.nowpayments_webhook_events from anon, authenticated;

-- Supports pruning; the ledger only needs to outlive NOWPayments' retry window.
create index nowpayments_webhook_events_received_idx
  on public.nowpayments_webhook_events (received_at desc);

-- Applying an IPN -----------------------------------------------------------
-- One statement from the caller's point of view, so one transaction: filing the
-- transaction row, linking it back to the payment and notifying the user cannot
-- half-apply.
--
-- Returns a short tag describing what happened, which the route logs. A null return
-- never happens; 'unknown' means the payment_id is not ours and is NOT retryable.
create or replace function public.apply_nowpayments_ipn(
  p_payment_id text,
  p_payment_status text,
  p_actually_paid numeric default null,
  p_actually_paid_at_fiat numeric default null,
  p_payin_hash text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_p public.nowpayments_payments;
  v_fiat numeric;
  v_tx_id uuid;
  v_label text;
begin
  -- The row lock serialises concurrent deliveries for the same payment, which is what
  -- makes the terminal-status guard below hold.
  select * into v_p
  from public.nowpayments_payments
  where payment_id = p_payment_id
  for update;

  if not found then
    return 'unknown';
  end if;

  -- A settled payment never reopens. Without this a late-arriving 'confirming' could
  -- un-reject an expired deposit, or reset the amount on one already approved.
  if v_p.payment_status in ('finished', 'failed', 'refunded', 'expired') then
    return 'already-terminal';
  end if;

  -- What we believe actually arrived, in USD. actually_paid_at_fiat is absent on the
  -- early statuses, so the requested amount stands in until the payer's real figure
  -- is known. nullif guards the 0 that arrives with 'waiting'.
  v_fiat := coalesce(nullif(p_actually_paid_at_fiat, 0), v_p.price_amount);

  v_label := upper(v_p.pay_currency) || ' · NOWPayments';

  update public.nowpayments_payments
  set payment_status = p_payment_status,
      actually_paid = coalesce(p_actually_paid, actually_paid),
      actually_paid_at_fiat = coalesce(nullif(p_actually_paid_at_fiat, 0), actually_paid_at_fiat),
      updated_at = now()
  where payment_id = p_payment_id;

  -- Money seen on-chain. 'waiting' means nothing has been sent yet, so it files nothing.
  if p_payment_status in ('confirming', 'confirmed', 'sending', 'partially_paid', 'finished') then
    -- transactions_amount_sign rejects a non-positive deposit, so a zero-value
    -- delivery must not reach the insert.
    if v_fiat <= 0 then
      return 'no-amount';
    end if;

    if v_p.transaction_id is null then
      insert into public.transactions (user_id, kind, amount, status, method, note)
      values (v_p.user_id, 'deposit', v_fiat, 'pending', v_label,
              'Payment detected · awaiting confirmation')
      returning id into v_tx_id;

      update public.nowpayments_payments
      set transaction_id = v_tx_id
      where payment_id = p_payment_id;

      insert into public.notifications (user_id, title, body, tone)
      values (v_p.user_id, 'Deposit detected',
              'We can see your ' || v_label || ' payment of ' ||
              public.money_text(v_fiat) || '. It will be credited once confirmed.', 'info');
    else
      -- Re-stating the amount is the point: the balance must end up matching what the
      -- payer actually sent, not what they said they would send.
      update public.transactions
      set amount = v_fiat,
          note = case
            when p_payment_status = 'partially_paid'
              then 'Underpaid · ' || public.money_text(v_fiat) || ' of ' ||
                   public.money_text(v_p.price_amount) || ' received'
            when p_payment_status = 'finished'
              then 'Payment confirmed · awaiting approval'
            else 'Payment detected · awaiting confirmation'
          end
      where id = v_p.transaction_id and status = 'pending';
    end if;
  end if;

  if p_payment_status = 'finished' then
    insert into public.notifications (user_id, title, body, tone)
    values (v_p.user_id, 'Payment confirmed',
            public.money_text(v_fiat) ||
            ' has been confirmed on-chain and is awaiting approval.', 'success');

  elsif p_payment_status = 'partially_paid' then
    insert into public.notifications (user_id, title, body, tone)
    values (v_p.user_id, 'Deposit underpaid',
            'We received ' || public.money_text(v_fiat) || ' of the ' ||
            public.money_text(v_p.price_amount) ||
            ' expected. The smaller amount will be credited once approved.', 'warning');

  elsif p_payment_status in ('failed', 'expired', 'refunded') then
    if v_p.transaction_id is not null then
      update public.transactions
      set status = 'rejected',
          resolved_at = now(),
          note = 'NOWPayments reported the payment ' || p_payment_status
      where id = v_p.transaction_id and status = 'pending';
    end if;

    -- An expired window with nothing sent is routine, so it is not worth a scary
    -- notification; a payment that failed or was refunded after sending is.
    if p_payment_status <> 'expired' or v_p.transaction_id is not null then
      insert into public.notifications (user_id, title, body, tone)
      values (v_p.user_id,
              case when p_payment_status = 'refunded' then 'Deposit refunded'
                   else 'Deposit unsuccessful' end,
              'Your ' || v_label || ' payment ' || p_payment_status ||
              '. Nothing was credited — start a new deposit or contact support.',
              'danger');
    end if;
  end if;

  return p_payment_status;
end;
$$;

-- Grants --------------------------------------------------------------------
-- Unlike the user-facing RPCs, this one is reachable only by the webhook route under
-- the service role. Postgres grants EXECUTE to PUBLIC on every new function and
-- Supabase additionally grants it to anon, so both have to come off.
revoke execute on function
  public.apply_nowpayments_ipn(text, text, numeric, numeric, text)
  from public, anon, authenticated;

grant execute on function
  public.apply_nowpayments_ipn(text, text, numeric, numeric, text)
  to service_role;
