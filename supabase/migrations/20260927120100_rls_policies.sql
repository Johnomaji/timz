-- Row Level Security for ApexVest.
--
-- Design rule: the browser may never move money. Clients can read their own data and
-- *request* deposits/withdrawals; every balance mutation, approval, and payout runs
-- server-side under the service role or a SECURITY DEFINER function. The prototype's
-- flaw was that balance lived in localStorage, so a user could edit it freely.
--
-- Note that both regular users and admins authenticate as the `authenticated` Postgres
-- role, so column-level GRANTs cannot distinguish them. Anything withheld from
-- `authenticated` below is therefore withheld from admins in the browser too, by
-- design — admin money operations go through the server, not the client.

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

-- SECURITY DEFINER above is what prevents infinite RLS recursion: the function reads
-- profiles without re-triggering the profiles policies that call it.
revoke all on function public.is_admin() from anon;

alter table public.profiles enable row level security;
alter table public.plans enable row level security;
alter table public.investments enable row level security;
alter table public.transactions enable row level security;
alter table public.notifications enable row level security;
alter table public.settings enable row level security;

-- Profiles ------------------------------------------------------------------
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
-- balance, role, status, referral_code and referred_by are intentionally absent.
grant update (name, phone, country, two_factor) on public.profiles to authenticated;

create policy "profiles: read own"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

create policy "profiles: admins read all"
  on public.profiles for select
  to authenticated
  using (public.is_admin());

create policy "profiles: update own"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Plans ---------------------------------------------------------------------
revoke all on public.plans from anon, authenticated;
grant select on public.plans to anon, authenticated;
grant insert, update, delete on public.plans to authenticated;

-- The public landing page lists plans, so anon reads the active ones.
create policy "plans: anyone reads active"
  on public.plans for select
  to anon, authenticated
  using (active or public.is_admin());

create policy "plans: admins insert"
  on public.plans for insert
  to authenticated
  with check (public.is_admin());

create policy "plans: admins update"
  on public.plans for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "plans: admins delete"
  on public.plans for delete
  to authenticated
  using (public.is_admin());

-- Investments ---------------------------------------------------------------
-- Read-only from the browser. Subscribing debits a balance, so it must happen in a
-- single server-side transaction; a client INSERT could create an investment without
-- the matching debit.
revoke all on public.investments from anon, authenticated;
grant select on public.investments to authenticated;

create policy "investments: read own"
  on public.investments for select
  to authenticated
  using (user_id = auth.uid());

create policy "investments: admins read all"
  on public.investments for select
  to authenticated
  using (public.is_admin());

-- Transactions --------------------------------------------------------------
-- Users may file deposit and withdrawal requests. They may not set status, so new rows
-- land as 'pending' and only the server can approve them. No update or delete grant
-- means a filed request is immutable from the browser.
revoke all on public.transactions from anon, authenticated;
grant select on public.transactions to authenticated;
-- 'reference' is excluded: a trigger assigns it, so clients cannot spoof one or squat
-- the unique index to block someone else's insert.
grant insert (user_id, kind, amount, method, note) on public.transactions to authenticated;

create policy "transactions: read own"
  on public.transactions for select
  to authenticated
  using (user_id = auth.uid());

create policy "transactions: admins read all"
  on public.transactions for select
  to authenticated
  using (public.is_admin());

-- 'earning', 'referral' and 'adjustment' are server-generated; allowing them here
-- would let a user fabricate income records.
create policy "transactions: request own deposit or withdrawal"
  on public.transactions for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and kind in ('deposit', 'withdrawal')
    and amount > 0
  );

-- Notifications -------------------------------------------------------------
revoke all on public.notifications from anon, authenticated;
grant select on public.notifications to authenticated;
grant update (read) on public.notifications to authenticated;

create policy "notifications: read own"
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

create policy "notifications: mark own read"
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Settings ------------------------------------------------------------------
-- Readable by anon because the landing and login pages render platform_name and the
-- maintenance flag before anyone signs in.
revoke all on public.settings from anon, authenticated;
grant select on public.settings to anon, authenticated;
grant update on public.settings to authenticated;

create policy "settings: anyone reads"
  on public.settings for select
  to anon, authenticated
  using (true);

create policy "settings: admins update"
  on public.settings for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());
