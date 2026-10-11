-- Verification is now a precondition for moving money, not a nudge.
--
-- The dashboard greys itself out and hides the forms, but these RPCs are public
-- endpoints reachable by any authenticated session, so the check has to live here too.
-- Same reasoning as the validation already duplicated from src/lib/store.tsx.
--
-- collect_investment() is deliberately left alone: the capital was only ever committed
-- by a verified account, and withholding a matured payout from someone whose status
-- later changed would trap their principal.

create or replace function public.request_deposit(p_amount numeric, p_method text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_min numeric;
  v_profile public.profiles;
begin
  if v_uid is null then
    raise exception 'Not signed in.';
  end if;

  select min_deposit into v_min from public.settings where id;

  if p_amount is null or p_amount < v_min then
    raise exception 'Minimum deposit is %.', public.money_text(v_min);
  end if;

  select * into v_profile from public.profiles where id = v_uid;

  if not found or v_profile.status <> 'active' then
    raise exception 'Your account is not active.';
  end if;

  if v_profile.kyc_status <> 'approved' then
    raise exception 'Verify your identity before depositing.';
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
  v_profile public.profiles;
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

  select * into v_profile
  from public.profiles
  where id = v_uid and status = 'active'
  for update;

  if not found then
    raise exception 'Your account is not active.';
  end if;

  if v_profile.kyc_status <> 'approved' then
    raise exception 'Verify your identity before withdrawing.';
  end if;

  if p_amount + v_fee > v_profile.balance then
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

create or replace function public.invest(p_plan_id text, p_amount numeric)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_plan public.plans;
  v_profile public.profiles;
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

  select * into v_profile
  from public.profiles
  where id = v_uid and status = 'active'
  for update;

  if not found then
    raise exception 'Your account is not active.';
  end if;

  if v_profile.kyc_status <> 'approved' then
    raise exception 'Verify your identity before investing.';
  end if;

  if p_amount > v_profile.balance then
    raise exception 'Insufficient balance. Make a deposit first.';
  end if;

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
