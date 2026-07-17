-- 2026-07-17 owner improvements: drafts may be saved without a price.
-- Run once in the Supabase SQL editor (project matcha-muse).
-- Completed reviews still require a price — enforced by the check below
-- (the app's Save button enforces it too; this keeps the DB honest).
alter table reviews alter column price drop not null;
alter table reviews add constraint price_required_when_complete
  check (status = 'draft' or price is not null);
