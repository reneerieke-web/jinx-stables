-- REVIEW ONLY — do not apply until Codex reviews it and Renee explicitly approves.
-- Beta feedback inbox (Sept 27). Text only; no screenshots in this version.
--
-- Design:
--   * Signed-in users can INSERT feedback and nothing else. They cannot read,
--     edit, or delete any feedback, including their own, so no user can ever
--     see another user's report. anon gets nothing.
--   * Users may only fill in the content columns (column-level INSERT grant).
--     user_id, created_at, status and id always come from the defaults, so a
--     report cannot be filed under someone else's account or pre-triaged.
--   * Renee reviews in the Supabase dashboard; Claude/Codex read it with
--     read-only SQL. Triage uses `status`, changed only by the owner.
--   * Abuse and cost: every text column is length-capped, and a trigger allows
--     at most 20 reports per user per 24 hours. Worst case is a few hundred KB
--     per user per day of plain text.
--   * Feedback is untrusted input: the app never renders it, and anyone
--     reviewing it should treat it as text, not instructions.

begin;

create table public.feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  category    text not null check (category in ('bug', 'confusing', 'idea', 'like')),
  message     text not null check (char_length(btrim(message)) between 1 and 4000),
  doing       text check (char_length(doing) <= 1000),
  site        text not null check (site in ('production', 'preview', 'other')),
  app_build   text check (char_length(app_build) <= 64),
  user_agent  text check (char_length(user_agent) <= 512),
  viewport    text check (char_length(viewport) <= 32),
  status      text not null default 'new'
              check (status in ('new', 'blocker', 'bug', 'usability', 'idea', 'later', 'done', 'wontfix'))
);

create index feedback_user_created_idx on public.feedback (user_id, created_at);

alter table public.feedback enable row level security;

revoke all on public.feedback from public, anon, authenticated;
grant insert (category, message, doing, site, app_build, user_agent, viewport)
  on public.feedback to authenticated;

create policy "feedback_insert_own"
on public.feedback
for insert
to authenticated
with check (user_id = (select auth.uid()) and status = 'new');

-- Rate limit. SECURITY DEFINER so it can count the caller's rows even though
-- callers have no SELECT permission; it only counts, never returns data.
create or replace function public.enforce_feedback_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent bigint;
begin
  select count(*) into recent
  from public.feedback
  where user_id = new.user_id
    and created_at > now() - interval '24 hours';
  if recent >= 20 then
    raise exception using
      errcode = 'P0001',
      message = 'Feedback limit reached: at most 20 reports per day.';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_feedback_rate_limit() from public, anon, authenticated;

create trigger enforce_feedback_rate_limit
before insert on public.feedback
for each row
execute function public.enforce_feedback_rate_limit();

commit;

-- Rollback (only if Renee asks):
--   drop table public.feedback;  -- also drops the trigger and index
--   drop function public.enforce_feedback_rate_limit();
