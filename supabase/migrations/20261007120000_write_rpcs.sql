-- Server-side write path for every mutation that moves money or changes privilege.
--
-- The RLS migration withholds profiles.balance/role/status and transactions.status from
-- the browser, so these operations have nowhere to run client-side. Each function below
-- is SECURITY DEFINER (bypassing RLS and the column grants) and therefore re-checks
-- authorization itself: auth.uid() for user actions, public.is_admin() for admin ones.
--
-- Every function is one statement from the client's point of view, so it is also one
-- transaction. That matters most in collect_investment(), which touches two balances,
-- an investment, two transactions and two notifications — a partial apply there would
-- credit an investor without paying their referrer.
--
-- Validation is duplicated from src/lib/store.tsx rather than trusted from it: an RPC
-- is a public endpoint, so the client checks are now just fast feedback.

create or replace function public.money_text(v numeric)
returns text
language sql
immutable
as $$
  select '$' || trim(to_char(v, 'FM999,999,999,990.00'));
$$;

-- Renders a rate the way the TS did: '3' not '3.00', '7.5' kept as '7.5'. The rtrim is
-- load-bearing — FM drops the trailing zero but leaves a dangling '.' behind.
create or replace function public.pct_text(v numeric)
returns text
language sql
immutable
as $$
  select rtrim(trim(to_char(v, 'FM990.99')), '.');
$$;

-- Deposits ------------------------------------------------------------------
-- A plain client INSERT would satisfy RLS, but notifications have no insert grant,
-- so filing the request and telling the user about it has to happen together.
create or replace function public.request_deposit(p_amount numeric, p_method text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_min numeric;
begin
  if v_uid is null then
    raise exception 'Not signed in.';
  end if;

  select min_deposit into v_min from public.settings where id;

  if p_amount is null or p_amount < v_min then
    raise exception 'Minimum deposit is %.', public.money_text(v_min);
  end if;

  if not exists (select 1 from public.profiles where id = v_uid and status = 'active') then
    raise exception 'Your account is not active.';
  end if;

  insert into public.transactions (user_id, kind, amount, status, method, note)
  values (v_uid, 'deposit', p_amount, 'pending', coalesce(p_method, ''),
          'Awaiting admin confirmation');

  insert into public.notifications (user_id, title, body, tone)
  values (v_uid, 'Deposit submitted',
          'We received your ' || coalesce(p_method, 'deposit') ||
          ' deposit request. It will be credited once confirmed.', 'info');
end;
$$;

-- Withdrawals ---------------------------------------------------------------
-- Funds are debited at request time and returned by resolve_transaction() on a
-- rejection, so a pending withdrawal cannot be double-spent.
create or replace function public.request_withdrawal(
  p_amount numeric,
  p_method text,
  p_address text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_min numeric;
  v_fee_pct numeric;
  v_fee numeric;
  v_balance numeric;
begin
  if v_uid is null then
    raise exception 'Not signed in.';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Enter a valid amount.';
  end if;

  select min_withdrawal, withdrawal_fee_pct
  into v_min, v_fee_pct
  from public.settings where id;

  if p_amount < v_min then
    raise exception 'Minimum withdrawal is %.', public.money_text(v_min);
  end if;

  v_fee := round(p_amount * v_fee_pct / 100, 2);

  select balance into v_balance
  from public.profiles
  where id = v_uid and status = 'active'
  for update;

  if not found then
    raise exception 'Your account is not active.';
  end if;

  if p_amount + v_fee > v_balance then
    raise exception 'Amount plus fee exceeds your available balance.';
  end if;

  update public.profiles set balance = balance - (p_amount + v_fee) where id = v_uid;

  insert into public.transactions (user_id, kind, amount, status, method, note)
  values (v_uid, 'withdrawal', p_amount, 'pending', coalesce(p_method, ''),
          'To ' || left(coalesce(p_address, ''), 10) || '… · fee ' ||
          public.pct_text(v_fee_pct) || '%');

  insert into public.notifications (user_id, title, body, tone)
  values (v_uid, 'Withdrawal requested',
          public.money_text(p_amount) || ' is on hold pending admin approval.', 'warning');
end;
$$;

-- Subscribing to a plan -----------------------------------------------------
create or replace function public.invest(p_plan_id text, p_amount numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_plan public.plans;
  v_balance numeric;
  v_roi numeric;
begin
  if v_uid is null then
    raise exception 'Not signed in.';
  end if;

  select * into v_plan from public.plans where id = p_plan_id;

  if not found or not v_plan.active then
    raise exception 'That plan is not available.';
  end if;

  if p_amount is null or p_amount < v_plan.min_amount then
    raise exception 'Minimum for % is %.', v_plan.name, public.money_text(v_plan.min_amount);
  end if;

  if p_amount > v_plan.max_amount then
    raise exception 'Maximum for % is %.', v_plan.name, public.money_text(v_plan.max_amount);
  end if;

  select balance into v_balance
  from public.profiles
  where id = v_uid and status = 'active'
  for update;

  if not found then
    raise exception 'Your account is not active.';
  end if;

  if p_amount > v_balance then
    raise exception 'Insufficient balance. Make a deposit first.';
  end if;

  -- Mirrors lockRoiPct(): one draw from the plan's band, rounded to 1dp, stored on the
  -- investment. Plans currently set min = max, so this is effectively the flat rate.
  -- random() is double precision; the cast is required because round(double, int) has no
  -- overload in Postgres.
  v_roi := round(
    (v_plan.roi_min_pct + random() * (v_plan.roi_max_pct - v_plan.roi_min_pct))::numeric,
    1
  );

  update public.profiles set balance = balance - p_amount where id = v_uid;

  insert into public.investments (user_id, plan_id, amount, roi_pct)
  values (v_uid, p_plan_id, p_amount, v_roi);

  insert into public.transactions (user_id, kind, amount, status, method, note, resolved_at)
  values (v_uid, 'investment', p_amount, 'completed', 'Account balance',
          v_plan.name || ' plan subscription', now());

  insert into public.notifications (user_id, title, body, tone)
  values (v_uid, v_plan.name || ' plan activated',
          'Your ' || public.money_text(p_amount) || ' allocation is locked at ' ||
          public.pct_text(v_roi) || '% over ' ||
          v_plan.duration_days || ' days.', 'success');
end;
$$;

-- Maturity payout -----------------------------------------------------------
create or replace function public.collect_investment(p_investment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_inv public.investments;
  v_plan public.plans;
  v_roi numeric;
  v_user public.profiles;
  v_commission_pct numeric;
  v_commission numeric;
begin
  if v_uid is null then
    raise exception 'Not signed in.';
  end if;

  -- The row lock is what makes a double-collect impossible under concurrent calls.
  select * into v_inv from public.investments where id = p_investment_id for update;

  if not found then
    raise exception 'Investment not found.';
  end if;

  if v_inv.user_id <> v_uid and not public.is_admin() then
    raise exception 'Investment not found.';
  end if;

  if v_inv.status <> 'active' then
    raise exception 'This plan has already been collected.';
  end if;

  select * into v_plan from public.plans where id = v_inv.plan_id;

  if not found then
    raise exception 'Plan missing for this investment.';
  end if;

  -- Enforced here and not only in the UI: this function is directly callable, and an
  -- early call would pay the full term's ROI before the term had run.
  if now() < v_inv.started_at + make_interval(days => v_plan.duration_days) then
    raise exception 'This plan has not matured yet.';
  end if;

  v_roi := round(v_inv.amount * v_inv.roi_pct / 100, 2);

  update public.investments
  set status = 'completed', payout_collected = v_roi
  where id = v_inv.id;

  update public.profiles
  set balance = balance + v_inv.amount + v_roi
  where id = v_inv.user_id
  returning * into v_user;

  -- transactions_amount_sign rejects a zero amount, so a 0% plan books no earning row.
  if v_roi > 0 then
    insert into public.transactions (user_id, kind, amount, status, method, note, resolved_at)
    values (v_inv.user_id, 'earning', v_roi, 'completed', v_plan.name || ' maturity',
            'Principal ' || public.money_text(v_inv.amount) || ' returned with ROI', now());
  end if;

  insert into public.notifications (user_id, title, body, tone)
  values (v_inv.user_id, 'Plan matured',
          public.money_text(v_inv.amount + v_roi) || ' was credited to your balance.',
          'success');

  if v_user.referred_by is null then
    return;
  end if;

  select referral_commission_pct into v_commission_pct from public.settings where id;
  v_commission := round(v_roi * v_commission_pct / 100, 2);

  if v_commission <= 0 then
    return;
  end if;

  update public.profiles
  set balance = balance + v_commission
  where id = v_user.referred_by;

  if not found then
    return;
  end if;

  insert into public.transactions (user_id, kind, amount, status, method, note, resolved_at)
  values (v_user.referred_by, 'referral', v_commission, 'completed', 'Referral commission',
          public.pct_text(v_commission_pct) || '% of ' || v_user.name || '''s ' ||
          v_plan.name || ' ROI', now());

  insert into public.notifications (user_id, title, body, tone)
  values (v_user.referred_by, 'Referral reward earned',
          'You earned ' || public.money_text(v_commission) || ' — ' ||
          public.pct_text(v_commission_pct) || '% of ' || v_user.name || '''s ROI.',
          'success');
end;
$$;

-- Admin: approving or rejecting a pending request ---------------------------
create or replace function public.resolve_transaction(
  p_tx_id uuid,
  p_decision text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tx public.transactions;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_fee_pct numeric;
begin
  if not public.is_admin() then
    raise exception 'Administrators only.';
  end if;

  if p_decision not in ('approved', 'rejected') then
    raise exception 'Decision must be approved or rejected.';
  end if;

  select * into v_tx from public.transactions where id = p_tx_id for update;

  if not found then
    raise exception 'Transaction not found.';
  end if;

  if v_tx.status <> 'pending' then
    raise exception 'This request was already resolved.';
  end if;

  update public.transactions
  set status = p_decision::public.tx_status,
      resolved_at = now(),
      note = coalesce(v_note, note)
  where id = v_tx.id;

  if v_tx.kind = 'deposit' and p_decision = 'approved' then
    update public.profiles set balance = balance + v_tx.amount where id = v_tx.user_id;

    insert into public.notifications (user_id, title, body, tone)
    values (v_tx.user_id, 'Deposit approved',
            public.money_text(v_tx.amount) || ' was credited to your available balance.',
            'success');

  elsif v_tx.kind = 'deposit' then
    insert into public.notifications (user_id, title, body, tone)
    values (v_tx.user_id, 'Deposit rejected',
            coalesce(v_note, 'We could not confirm this payment. Contact support.'), 'danger');

  elsif v_tx.kind = 'withdrawal' and p_decision = 'approved' then
    insert into public.notifications (user_id, title, body, tone)
    values (v_tx.user_id, 'Withdrawal sent',
            public.money_text(v_tx.amount) || ' was released to your wallet.', 'success');

  elsif v_tx.kind = 'withdrawal' then
    -- Fee is recomputed from current settings, matching the prototype. If the fee rate
    -- changed while the request sat pending, the refund follows the new rate.
    select withdrawal_fee_pct into v_fee_pct from public.settings where id;

    update public.profiles
    set balance = balance + v_tx.amount + round(v_tx.amount * v_fee_pct / 100, 2)
    where id = v_tx.user_id;

    insert into public.notifications (user_id, title, body, tone)
    values (v_tx.user_id, 'Withdrawal rejected',
            coalesce(v_note, 'Your funds were returned to your available balance.'),
            'danger');
  end if;
end;
$$;

-- Admin: manual balance correction ------------------------------------------
create or replace function public.adjust_balance(
  p_user_id uuid,
  p_delta numeric,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrators only.';
  end if;

  if p_delta is null or p_delta = 0 then
    raise exception 'Enter a non-zero amount.';
  end if;

  -- greatest() mirrors the prototype's Math.max(0, …): a debit larger than the balance
  -- empties the account rather than failing the balance >= 0 check constraint.
  update public.profiles
  set balance = greatest(0, balance + p_delta)
  where id = p_user_id;

  if not found then
    raise exception 'User not found.';
  end if;

  insert into public.transactions (user_id, kind, amount, status, method, note, resolved_at)
  values (p_user_id, 'adjustment', abs(p_delta), 'completed',
          case when p_delta >= 0 then 'Admin credit' else 'Admin debit' end,
          coalesce(p_note, ''), now());

  -- The tone cast is required: a bare literal coerces to the enum, a CASE does not.
  insert into public.notifications (user_id, title, body, tone)
  values (p_user_id,
          case when p_delta >= 0 then 'Balance credited' else 'Balance debited' end,
          coalesce(p_note, '') || ' · ' || public.money_text(abs(p_delta)),
          (case when p_delta >= 0 then 'success' else 'warning' end)::public.notification_tone);
end;
$$;

-- Admin: suspend or reinstate an account ------------------------------------
create or replace function public.set_user_status(p_user_id uuid, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Administrators only.';
  end if;

  if p_status not in ('active', 'suspended') then
    raise exception 'Unknown status.';
  end if;

  update public.profiles
  set status = p_status::public.user_status
  where id = p_user_id;

  if not found then
    raise exception 'User not found.';
  end if;

  insert into public.notifications (user_id, title, body, tone)
  values (p_user_id,
          case when p_status = 'suspended' then 'Account suspended'
               else 'Account reinstated' end,
          case when p_status = 'suspended'
               then 'Your account was suspended by an administrator.'
               else 'Your account is active again.' end,
          (case when p_status = 'suspended' then 'danger' else 'success' end)::public.notification_tone);
end;
$$;

-- Grants --------------------------------------------------------------------
-- Two separate grants have to be removed before the grant to authenticated means
-- anything: Postgres gives EXECUTE to PUBLIC on every new function, and Supabase's
-- default privileges additionally grant it to anon directly. Revoking only PUBLIC
-- leaves anon's own grant in place.
revoke execute on function public.request_deposit(numeric, text) from public, anon;
revoke execute on function public.request_withdrawal(numeric, text, text) from public, anon;
revoke execute on function public.invest(text, numeric) from public, anon;
revoke execute on function public.collect_investment(uuid) from public, anon;
revoke execute on function public.resolve_transaction(uuid, text, text) from public, anon;
revoke execute on function public.adjust_balance(uuid, numeric, text) from public, anon;
revoke execute on function public.set_user_status(uuid, text) from public, anon;

grant execute on function public.request_deposit(numeric, text) to authenticated;
grant execute on function public.request_withdrawal(numeric, text, text) to authenticated;
grant execute on function public.invest(text, numeric) to authenticated;
grant execute on function public.collect_investment(uuid) to authenticated;
grant execute on function public.resolve_transaction(uuid, text, text) to authenticated;
grant execute on function public.adjust_balance(uuid, numeric, text) to authenticated;
grant execute on function public.set_user_status(uuid, text) to authenticated;
