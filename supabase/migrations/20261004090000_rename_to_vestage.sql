-- ApexVest -> Vestage rebrand.
--
-- Written as a forward migration rather than an edit to 20260927120000_init_schema.sql
-- because that migration is already applied to the cloud project; rewriting applied
-- history would leave the local files and the live database describing different schemas.

alter table public.settings
  alter column platform_name set default 'Vestage';

update public.settings
set platform_name = 'Vestage',
    support_email = replace(support_email, '@apexvest.io', '@vestage.io')
where platform_name = 'ApexVest';

-- Existing members keep working codes; only the prefix changes.
update public.profiles
set referral_code = 'VEST-' || substr(referral_code, 6)
where referral_code like 'APEX-%';

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
  prefix := coalesce(nullif(substr(prefix, 1, 2), ''), 'VX');

  -- Retry on the unique index rather than trusting a single draw.
  for _ in 1..20 loop
    candidate := 'VEST-' || prefix || upper(substr(md5(random()::text), 1, 3));
    if not exists (select 1 from public.profiles where referral_code = candidate) then
      return candidate;
    end if;
  end loop;

  return 'VEST-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8));
end;
$$;
