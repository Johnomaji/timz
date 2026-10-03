-- ApexVest demo data, ported from src/lib/seed.ts.
--
-- Users are created through auth.users so Supabase hashes their passwords with bcrypt;
-- this replaces the prototype's plaintext password fields. Inserting into auth.users
-- also fires handle_new_user(), so profile rows and referral codes come from the same
-- trigger real signups use — the seed exercises that path rather than bypassing it.
--
-- Re-runnable: the deletes at the top cascade through profiles to every child table.

create extension if not exists pgcrypto with schema extensions;

set search_path = public, extensions;

-- Reset ---------------------------------------------------------------------
delete from auth.users
where email in ('admin@apexvest.io', 'user@apexvest.io')
   or email like '%@example.com';

delete from public.plans;

-- Plans ---------------------------------------------------------------------
insert into public.plans (
  id, name, tagline, roi_min_pct, roi_max_pct, duration_days,
  min_amount, max_amount, accent, perks, active, sort_order
) values
  (
    'plan_1m', '1 Month', 'Fixed rate, shortest commitment',
    2, 2, 30, 500, 100000, 'warn',
    array[
      'Flat 2% — no rate variance',
      'Principal plus ROI paid at maturity',
      'Email support'
    ],
    true, 1
  ),
  (
    'plan_3m', '3 Months', 'Short lock-up to get started',
    6, 8, 90, 500, 100000, 'cyan',
    array[
      'Rate locked in when you subscribe',
      'Principal plus ROI paid at maturity',
      'Email support'
    ],
    true, 2
  ),
  (
    'plan_6m', '6 Months', 'Our most popular balance of yield and term',
    20, 30, 180, 500, 100000, 'brand',
    array[
      'Rate locked in when you subscribe',
      'Principal plus ROI paid at maturity',
      'Priority withdrawals',
      'Dedicated account manager'
    ],
    true, 3
  ),
  (
    'plan_1y', '1 Year', 'Longest term, highest return',
    70, 80, 365, 500, 100000, 'violet',
    array[
      'Rate locked in when you subscribe',
      'Principal plus ROI paid at maturity',
      'Zero withdrawal fees',
      'Quarterly strategy calls',
      '24/7 desk access'
    ],
    true, 4
  );

-- Settings ------------------------------------------------------------------
-- The migration already inserted the singleton row, so this updates it.
update public.settings set
  platform_name = 'ApexVest',
  support_email = 'support@apexvest.io',
  min_deposit = 100,
  min_withdrawal = 50,
  withdrawal_fee_pct = 1.5,
  referral_commission_pct = 10,
  maintenance_mode = false,
  signups_open = true,
  wallets = '[
    {"asset":"USDT","network":"TRC20","address":"TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE"},
    {"asset":"BTC","network":"Bitcoin","address":"bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq"},
    {"asset":"ETH","network":"ERC20","address":"0x71C7656EC7ab88b098defB751B7401B5f6d8976F"}
  ]'::jsonb
where id;

-- Signup helper -------------------------------------------------------------
-- pg_temp so it vanishes with the session and never becomes part of the schema.
create or replace function pg_temp.seed_user(
  p_email text,
  p_password text,
  p_meta jsonb,
  p_joined_days_ago int
) returns uuid
language plpgsql
as $$
declare
  new_id uuid := gen_random_uuid();
  joined timestamptz := now() - make_interval(days => p_joined_days_ago);
begin
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, created_at, updated_at,
    raw_app_meta_data, raw_user_meta_data
  ) values (
    '00000000-0000-0000-0000-000000000000', new_id, 'authenticated', 'authenticated',
    lower(p_email), extensions.crypt(p_password, extensions.gen_salt('bf')),
    joined, joined, joined,
    jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
    p_meta
  );

  -- Required for the email provider to resolve this user at sign-in.
  insert into auth.identities (
    id, user_id, provider_id, identity_data, provider,
    last_sign_in_at, created_at, updated_at
  ) values (
    gen_random_uuid(), new_id, new_id::text,
    jsonb_build_object('sub', new_id::text, 'email', lower(p_email), 'email_verified', true),
    'email', joined, joined, joined
  );

  return new_id;
end;
$$;

-- Demo accounts and activity ------------------------------------------------
do $$
declare
  admin_id uuid;
  demo_id uuid;
  person_id uuid;
  people text[][] := array[
    ['Adaeze Okonkwo',     'adaeze@example.com', 'Nigeria'],
    ['Marcus Lindqvist',   'marcus@example.com', 'Sweden'],
    ['Priya Raghunathan',  'priya@example.com',  'India'],
    ['Tobias Brandt',      'tobias@example.com', 'Germany'],
    ['Sofia Marchetti',    'sofia@example.com',  'Italy'],
    ['Daniel Okafor',      'daniel@example.com', 'Nigeria'],
    ['Yuki Tanaka',        'yuki@example.com',   'Japan'],
    ['Elena Petrova',      'elena@example.com',  'Estonia'],
    ['Kwame Mensah',       'kwame@example.com',  'Ghana']
  ];
  methods text[] := array['USDT · TRC20', 'BTC', 'ETH', 'USDC · ERC20'];
  person_ids uuid[] := '{}';
  idx int;
  plan_rec record;
  inv_amount numeric(18,2);
  inv_age int;
  inv_roi numeric(6,2);
  dep_status public.tx_status;
  wdr_status public.tx_status;
begin
  -- Deterministic so repeated seeds produce the same dashboard.
  perform setseed(0.20260923);

  admin_id := pg_temp.seed_user(
    'admin@apexvest.io', 'admin123',
    jsonb_build_object('name', 'Nadia Reyes', 'country', 'Singapore', 'phone', '+65 8123 4477'),
    420
  );

  update public.profiles set
    role = 'admin',
    avatar_hue = 268,
    balance = 0,
    referral_code = 'APEX-ADMIN',
    two_factor = true,
    joined_at = now() - interval '420 days',
    last_active_at = now() - interval '1 hour'
  where id = admin_id;

  demo_id := pg_temp.seed_user(
    'user@apexvest.io', 'user123',
    jsonb_build_object('name', 'James Whitfield', 'country', 'United Kingdom', 'phone', '+44 7700 900112'),
    96
  );

  update public.profiles set
    avatar_hue = 158,
    balance = 18420.50,
    referral_code = 'APEX-JW4Q',
    joined_at = now() - interval '96 days',
    last_active_at = now()
  where id = demo_id;

  -- Supporting cast. The first three are referred by the demo investor so the
  -- referrals page has content; index 8 is suspended so the admin user list shows
  -- a non-active row.
  for idx in 1 .. array_length(people, 1) loop
    person_id := pg_temp.seed_user(
      people[idx][2], 'user123',
      jsonb_build_object('name', people[idx][1], 'country', people[idx][3]),
      floor(6 + random() * 300)::int
    );
    person_ids := person_ids || person_id;

    update public.profiles set
      balance = round((400 + random() * 41600)::numeric / 50) * 50,
      phone = '+1 ' || floor(200 + random() * 700)::text || ' ' || floor(1000 + random() * 8999)::text,
      status = case when idx = 8 then 'suspended'::public.user_status else 'active' end,
      referred_by = case when idx <= 3 then demo_id else null end,
      two_factor = random() > 0.6,
      last_active_at = now() - make_interval(days => floor(random() * 9)::int, hours => floor(random() * 20)::int)
    where id = person_id;
  end loop;

  -- Demo investor: a readable, hand-picked history.
  for plan_rec in
    select * from (values
      ('plan_6m', 25000::numeric, 120, 23.4::numeric),
      ('plan_3m',  5000::numeric,  95,  7.2::numeric),
      ('plan_1y', 60000::numeric,  40, 74.5::numeric),
      ('plan_1m',  2000::numeric,  45,  2.0::numeric)
    ) as t(plan_id, amount, age_days, roi_pct)
  loop
    insert into public.investments (user_id, plan_id, amount, started_at, status, roi_pct, payout_collected)
    select
      demo_id, plan_rec.plan_id, plan_rec.amount,
      now() - make_interval(days => plan_rec.age_days),
      case when plan_rec.age_days >= p.duration_days then 'completed'::public.investment_status else 'active' end,
      plan_rec.roi_pct,
      case when plan_rec.age_days >= p.duration_days then plan_rec.amount * plan_rec.roi_pct / 100 else 0 end
    from public.plans p where p.id = plan_rec.plan_id;

    insert into public.transactions (user_id, kind, amount, status, method, note, created_at, resolved_at)
    select
      demo_id, 'investment', plan_rec.amount, 'completed', 'Account balance',
      p.name || ' plan subscription',
      now() - make_interval(days => plan_rec.age_days),
      now() - make_interval(days => plan_rec.age_days)
    from public.plans p where p.id = plan_rec.plan_id;
  end loop;

  -- Deposits, including one pending item for the admin queue.
  insert into public.transactions (user_id, kind, amount, status, method, note, created_at, resolved_at)
  values
    (demo_id, 'deposit', 12000, 'approved', 'USDT · TRC20', 'Credited to balance',
     now() - interval '44 days', now() - interval '44 days' + interval '5 hours'),
    (demo_id, 'deposit', 6500, 'approved', 'BTC', 'Credited to balance',
     now() - interval '30 days', now() - interval '30 days' + interval '5 hours'),
    (demo_id, 'deposit', 15000, 'approved', 'ETH', 'Credited to balance',
     now() - interval '14 days', now() - interval '14 days' + interval '5 hours'),
    (demo_id, 'deposit', 3200, 'pending', 'USDC · ERC20', 'Awaiting network confirmation',
     now() - interval '2 days', null);

  -- Withdrawals.
  insert into public.transactions (user_id, kind, amount, status, method, note, created_at, resolved_at)
  values
    (demo_id, 'withdrawal', 4000, 'approved', 'USDT · TRC20', 'Sent to wallet',
     now() - interval '21 days', now() - interval '21 days' + interval '10 hours'),
    (demo_id, 'withdrawal', 1800, 'pending', 'USDT · TRC20', 'Queued for admin review',
     now() - interval '6 days', null);

  -- 26 days of ROI accrual, so the dashboard chart has a curve.
  insert into public.transactions (user_id, kind, amount, status, method, note, created_at, resolved_at)
  select
    demo_id, 'earning', round((110 + random() * 260)::numeric, 2), 'completed', 'ROI accrual',
    'Accrued on active plans',
    now() - make_interval(days => d, hours => 4),
    now() - make_interval(days => d, hours => 4)
  from generate_series(1, 26) as d;

  -- Referral commissions from the three referred users.
  insert into public.transactions (user_id, kind, amount, status, method, note, created_at, resolved_at)
  select
    demo_id, 'referral', round((60 + random() * 340)::numeric, 2), 'completed', 'Referral commission',
    '10% of ' || p.name || '''s plan ROI',
    now() - make_interval(days => floor(3 + random() * 40)::int),
    now() - make_interval(days => floor(3 + random() * 40)::int)
  from public.profiles p
  where p.referred_by = demo_id;

  -- Supporting cast activity: one plan each for most, plus deposits and withdrawals
  -- that leave several pending items in the admin queues.
  for idx in 1 .. array_length(person_ids, 1) loop
    select * into plan_rec from public.plans order by random() limit 1;

    inv_age := floor(random() * plan_rec.duration_days * 1.4);
    dep_status := case when idx % 3 = 1 then 'pending'::public.tx_status else 'approved' end;
    wdr_status := case when idx % 4 = 1 then 'pending'::public.tx_status else 'approved' end;

    if idx <> 8 and random() > 0.25 then
      inv_amount := round(
        (plan_rec.min_amount + random() * (least(plan_rec.max_amount, plan_rec.min_amount * 4) - plan_rec.min_amount))::numeric / 50
      ) * 50;
      inv_roi := round((plan_rec.roi_min_pct + random() * (plan_rec.roi_max_pct - plan_rec.roi_min_pct))::numeric, 1);

      insert into public.investments (user_id, plan_id, amount, started_at, status, roi_pct, payout_collected)
      values (
        person_ids[idx], plan_rec.id, inv_amount,
        now() - make_interval(days => inv_age),
        case when inv_age >= plan_rec.duration_days then 'completed'::public.investment_status else 'active' end,
        inv_roi,
        case when inv_age >= plan_rec.duration_days then inv_amount * inv_roi / 100 else 0 end
      );
    end if;

    insert into public.transactions (user_id, kind, amount, status, method, note, created_at, resolved_at)
    values (
      person_ids[idx], 'deposit',
      round((300 + random() * 23700)::numeric / 50) * 50,
      dep_status,
      methods[1 + floor(random() * array_length(methods, 1))::int],
      case when dep_status = 'pending' then 'Proof of payment uploaded' else 'Credited to balance' end,
      now() - make_interval(days => floor(random() * 20)::int, hours => floor(random() * 22)::int),
      case when dep_status = 'pending' then null else now() - make_interval(days => floor(random() * 20)::int) end
    );

    if idx % 2 = 1 then
      insert into public.transactions (user_id, kind, amount, status, method, note, created_at, resolved_at)
      values (
        person_ids[idx], 'withdrawal',
        round((200 + random() * 8800)::numeric / 50) * 50,
        wdr_status,
        methods[1 + floor(random() * array_length(methods, 1))::int],
        case when wdr_status = 'pending' then 'Queued for admin review' else 'Sent to wallet' end,
        now() - make_interval(days => floor(random() * 16)::int, hours => floor(random() * 22)::int),
        case when wdr_status = 'pending' then null else now() - make_interval(days => floor(random() * 16)::int) end
      );
    end if;
  end loop;

  -- Notifications -----------------------------------------------------------
  insert into public.notifications (user_id, title, body, tone, read, created_at) values
    (demo_id, '3 Months plan matured',
     'Your 3 Months plan paid $5,640.00 — principal plus ROI — into your available balance.',
     'success', false, now() - interval '3 hours'),
    (demo_id, 'Deposit awaiting confirmation',
     'We detected your $3,200.00 deposit and are waiting on network confirmations.',
     'info', false, now() - interval '2 days'),
    (demo_id, 'Withdrawal under review',
     'Your $1,800.00 withdrawal request is queued for admin approval.',
     'warning', false, now() - interval '6 days'),
    (demo_id, 'Referral reward earned',
     'You received 10% of a referral''s matured plan ROI.',
     'success', true, now() - interval '40 days'),
    (admin_id, '4 items need review',
     'Pending deposits and withdrawals are waiting in your queues.',
     'warning', false, now() - interval '2 hours');
end;
$$;
