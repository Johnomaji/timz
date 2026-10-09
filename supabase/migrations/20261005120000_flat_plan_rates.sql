-- Flat plan rates: 1M 3%, 3M 12%, 6M 35%, 1Y 100%.
--
-- Replaces the min/max bands with a single fixed return per plan, so roi_min_pct
-- equals roi_max_pct everywhere and a subscription no longer draws a random rate.
--
-- Existing investments are deliberately left alone: each one stores the rate it was
-- sold at, and rewriting history here would change what an investor is owed.
update public.plans as p
set roi_min_pct = v.pct,
    roi_max_pct = v.pct,
    perks[1] = 'Fixed rate — no variance'
from (values
  ('plan_1m', 3),
  ('plan_3m', 12),
  ('plan_6m', 35),
  ('plan_1y', 100)
) as v (id, pct)
where p.id = v.id;
