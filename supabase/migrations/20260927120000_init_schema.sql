-- ApexVest core schema.
--
-- Money is numeric(18,2) rather than float. supabase-js returns numeric as a string,
-- so the client mapping layer must parse it; the tradeoff is deliberate because ROI
-- accrual compounds and float drift would corrupt balances over time.

create type public.user_role as enum ('user', 'admin');
create type public.user_status as enum ('active', 'suspended');
create type public.investment_status as enum ('active', 'completed', 'cancelled');
create type public.tx_kind as enum ('deposit', 'withdrawal', 'investment', 'earning', 'referral', 'adjustment');
create type public.tx_status as enum ('pending', 'approved', 'rejected', 'completed');
create type public.plan_accent as enum ('brand', 'violet', 'cyan', 'warn');
create type public.notification_tone as enum ('info', 'success', 'warning', 'danger');

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Profiles ------------------------------------------------------------------
-- Deliberately has no password column: auth.users owns credentials. This replaces
-- the prototype's plaintext User.password.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  email text not null unique,
  role public.user_role not null default 'user',
  status public.user_status not null default 'active',
  avatar_hue smallint not null default 210 check (avatar_hue between 0 and 359),
  balance numeric(18, 2) not null default 0 check (balance >= 0),
  country text not null default '',
  phone text not null default '',
  joined_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  referral_code text not null unique,
  referred_by uuid references public.profiles (id) on delete set null,
  two_factor boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_referred_by_idx on public.profiles (referred_by);
create index profiles_role_status_idx on public.profiles (role, status);

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Plans ---------------------------------------------------------------------
-- Text ids keep the existing 'plan_3m' slugs the UI already references.
create table public.plans (
  id text primary key,
  name text not null,
  tagline text not null default '',
  roi_min_pct numeric(6, 2) not null check (roi_min_pct >= 0),
  roi_max_pct numeric(6, 2) not null check (roi_max_pct >= 0),
  duration_days integer not null check (duration_days > 0),
  min_amount numeric(18, 2) not null check (min_amount >= 0),
  max_amount numeric(18, 2) not null,
  accent public.plan_accent not null default 'brand',
  perks text[] not null default '{}',
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint plans_roi_range check (roi_max_pct >= roi_min_pct),
  constraint plans_amount_range check (max_amount >= min_amount)
);

create trigger plans_touch_updated_at
  before update on public.plans
  for each row execute function public.touch_updated_at();

-- Investments ---------------------------------------------------------------
create table public.investments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_id text not null references public.plans (id) on delete restrict,
  amount numeric(18, 2) not null check (amount > 0),
  started_at timestamptz not null default now(),
  status public.investment_status not null default 'active',
  -- Total-return rate locked in at subscription, drawn from the plan's range.
  roi_pct numeric(6, 2) not null check (roi_pct >= 0),
  payout_collected numeric(18, 2) not null default 0 check (payout_collected >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index investments_user_status_idx on public.investments (user_id, status);
create index investments_plan_idx on public.investments (plan_id);

create trigger investments_touch_updated_at
  before update on public.investments
  for each row execute function public.touch_updated_at();

-- Transactions --------------------------------------------------------------
create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind public.tx_kind not null,
  amount numeric(18, 2) not null,
  status public.tx_status not null default 'pending',
  method text not null default '',
  -- Filled by set_transaction_reference() below, never by the client.
  reference text not null unique,
  note text not null default '',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  -- Admin balance corrections may be negative; nothing else may be.
  constraint transactions_amount_sign check (
    case when kind = 'adjustment' then amount <> 0 else amount > 0 end
  ),
  -- A settled transaction must record when it settled.
  constraint transactions_resolved_consistency check (
    (status in ('pending') and resolved_at is null) or status not in ('pending')
  )
);

create index transactions_user_created_idx on public.transactions (user_id, created_at desc);
create index transactions_pending_idx on public.transactions (kind, created_at desc)
  where status = 'pending';

-- References are server-assigned. If clients could supply them they could spoof a
-- reference or squat the unique index to block another user's insert. BEFORE INSERT
-- triggers run ahead of the NOT NULL check, so an omitted reference is filled here.
create or replace function public.set_transaction_reference()
returns trigger
language plpgsql
as $$
declare
  prefix text;
begin
  prefix := case new.kind
    when 'deposit' then 'DEP'
    when 'withdrawal' then 'WDR'
    when 'investment' then 'INV'
    when 'earning' then 'ROI'
    when 'referral' then 'REF'
    when 'adjustment' then 'ADJ'
  end;

  if new.reference is null or trim(new.reference) = '' then
    new.reference := prefix || '-' || upper(substr(md5(gen_random_uuid()::text), 1, 8));
  end if;

  return new;
end;
$$;

create trigger transactions_set_reference
  before insert on public.transactions
  for each row execute function public.set_transaction_reference();

-- Notifications -------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text not null default '',
  tone public.notification_tone not null default 'info',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where read = false;

-- Settings ------------------------------------------------------------------
-- Single-row table; the boolean primary key with a check constraint makes a
-- second row impossible.
create table public.settings (
  id boolean primary key default true check (id),
  platform_name text not null default 'ApexVest',
  support_email text not null default '',
  min_deposit numeric(18, 2) not null default 100 check (min_deposit >= 0),
  min_withdrawal numeric(18, 2) not null default 50 check (min_withdrawal >= 0),
  withdrawal_fee_pct numeric(6, 2) not null default 0 check (withdrawal_fee_pct between 0 and 100),
  referral_commission_pct numeric(6, 2) not null default 0 check (referral_commission_pct between 0 and 100),
  maintenance_mode boolean not null default false,
  signups_open boolean not null default true,
  wallets jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create trigger settings_touch_updated_at
  before update on public.settings
  for each row execute function public.touch_updated_at();

insert into public.settings (id) values (true);

-- Referral codes ------------------------------------------------------------
create or replace function public.generate_referral_code(seed_name text)
returns text
language plpgsql
volatile
as $$
declare
  prefix text;
  candidate text;
begin
  prefix := upper(regexp_replace(coalesce(split_part(seed_name, ' ', 1), ''), '[^A-Za-z]', '', 'g'));
  prefix := coalesce(nullif(substr(prefix, 1, 2), ''), 'AX');

  -- Retry on the unique index rather than trusting a single draw.
  for _ in 1..20 loop
    candidate := 'APEX-' || prefix || upper(substr(md5(random()::text), 1, 3));
    if not exists (select 1 from public.profiles where referral_code = candidate) then
      return candidate;
    end if;
  end loop;

  return 'APEX-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
end;
$$;

-- Profile creation on signup ------------------------------------------------
-- SECURITY DEFINER because the signing-up user has no profile row yet and so
-- cannot satisfy any RLS policy on public.profiles.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  referrer_id uuid;
  supplied_code text;
begin
  supplied_code := nullif(trim(new.raw_user_meta_data ->> 'referral_code'), '');

  if supplied_code is not null then
    select id into referrer_id
    from public.profiles
    where lower(referral_code) = lower(supplied_code)
      and status = 'active';
  end if;

  insert into public.profiles (
    id, name, email, avatar_hue, country, phone, referral_code, referred_by
  )
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'name'), ''), split_part(new.email, '@', 1)),
    new.email,
    floor(random() * 360)::smallint,
    coalesce(new.raw_user_meta_data ->> 'country', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    public.generate_referral_code(coalesce(new.raw_user_meta_data ->> 'name', new.email)),
    referrer_id
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
