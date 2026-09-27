-- REVIEW ONLY — do not apply until Claude and Renee approve it.
-- Proposed limits:
--   * 32 KiB of JSON text per horse
--   * 2,000 horse rows per stable (including soft-deleted rows)
--   * 100 characters per stable name

begin;

alter table public.horses
  add constraint horses_data_max_32kb
  check (octet_length(data::text) <= 32768)
  not valid;

alter table public.horses
  validate constraint horses_data_max_32kb;

alter table public.stables
  add constraint stables_name_max_100_chars
  check (char_length(name) <= 100)
  not valid;

alter table public.stables
  validate constraint stables_name_max_100_chars;

create or replace function public.enforce_horses_per_stable_limit()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  horse_row_count bigint;
begin
  -- Serialize inserts for one stable so simultaneous requests cannot both
  -- pass the count check and exceed the limit.
  perform 1
  from public.stables
  where id = new.stable_id
  for update;

  -- Supabase upsert runs BEFORE INSERT triggers before resolving a conflict.
  -- Allow an existing (stable_id, id) row to continue to the update path even
  -- when the stable already contains exactly 2,000 rows.
  if exists (
    select 1
    from public.horses
    where stable_id = new.stable_id
      and id = new.id
  ) then
    return new;
  end if;

  select count(*)
  into horse_row_count
  from public.horses
  where stable_id = new.stable_id;

  if horse_row_count >= 2000 then
    raise exception using
      errcode = 'P0001',
      message = 'A stable can contain at most 2,000 horse rows.',
      hint = 'Remove a horse row before adding another.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_horses_per_stable_limit() from public;
revoke all on function public.enforce_horses_per_stable_limit() from anon;
revoke all on function public.enforce_horses_per_stable_limit() from authenticated;

create trigger enforce_horses_per_stable_limit
before insert on public.horses
for each row
execute function public.enforce_horses_per_stable_limit();

commit;
