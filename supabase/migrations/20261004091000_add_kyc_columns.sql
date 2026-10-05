-- Didit identity verification state on profiles.
--
-- Only the webhook (service role) writes these columns. The owning user can read them
-- through the existing profiles select policy but must not be able to set their own
-- status to 'approved', so no update policy is granted here.

create type public.kyc_status as enum ('unverified', 'pending', 'approved', 'declined');

alter table public.profiles
  add column kyc_status public.kyc_status not null default 'unverified',
  add column kyc_session_id text,
  add column kyc_updated_at timestamptz;

create index profiles_kyc_status_idx on public.profiles (kyc_status);
