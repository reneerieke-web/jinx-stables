-- REVIEW ONLY — do not apply until Codex reviews it and Renee explicitly approves.
-- Revision 2 (Codex review of 0e038e4): advisory-locked limits, helpers moved
-- to a non-exposed private schema, and an upload-only SELECT policy.
--
-- Optional screenshot on a beta feedback report. Builds on the applied
-- 20260927_feedback.sql (insert-only feedback table).
--
-- Flow (app side):
--   1. The app makes the report's id itself (random UUID) and inserts the
--      feedback row with has_screenshot = true. The text is saved first, so a
--      failed picture can never lose the written report.
--   2. It then uploads one JPEG to feedback-screenshots/{user id}/{report id}.jpg.
--      Storage accepts that upload only if a matching report of the uploader's
--      own, flagged has_screenshot, was created within the last hour.
--   3. If the upload fails, the report stays saved and the app offers Try again
--      (allowed for that hour). Renee sees has_screenshot = true with no file.
--
-- Access:
--   * Testers can upload exactly one picture per flagged report of their own
--     and nothing else: no listing, downloading, info, replacing, or deleting
--     any feedback picture, including their own. anon gets nothing.
--   * The SELECT policy below exists only because the Storage upload may read
--     back the row it inserts (INSERT ... RETURNING). It is scoped to the
--     upload operation (storage.allow_only_operation), so list, download and
--     info requests never match it.
--   * The stored path is a generated column (user id + report id), so a user
--     cannot point a report at any other file.
--   * Renee reviews in the dashboard (Storage > feedback-screenshots, or a
--     signed URL). The dashboard / service role bypasses RLS.
--   * SECURITY DEFINER helpers live in schema `private`, which the Data API
--     does not expose, with a fixed empty search_path, explicit auth.uid()
--     checks, and EXECUTE only where needed.
--
-- Abuse and cost:
--   * Bucket: private, image/jpeg only, 800 KB per file.
--   * At most 5 reports with a screenshot per user per 24 hours (on top of the
--     existing 20 reports/day), one file per report: about 4 MB per user per
--     day at worst. Both limits take a per-user transaction advisory lock
--     before counting, so parallel inserts cannot slip past them.
--   * A picture can only be uploaded within an hour of its report.

begin;

-- 0. Private schema for SECURITY DEFINER helpers (not in the Data API's
--    exposed schemas). authenticated needs USAGE only because the storage
--    policy calls the upload helper.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

-- 1. Feedback table: link to at most one picture.
alter table public.feedback
  add column has_screenshot boolean not null default false;
alter table public.feedback
  add column screenshot_path text
  generated always as (
    case when has_screenshot then user_id::text || '/' || id::text || '.jpg' end
  ) stored;

-- The app now supplies the report id (so it knows the file name without
-- reading the row back) and the has_screenshot flag. user_id, status and
-- created_at still always come from the defaults, and users still cannot
-- SELECT, UPDATE or DELETE any feedback.
grant insert (id, has_screenshot) on public.feedback to authenticated;

-- 2. Limits, serialized per user. Both triggers take the same transaction-
--    level advisory lock (re-entrant within one transaction), so a second
--    concurrent insert by the same user waits until the first commits, then
--    counts it. The existing 20/day limit had the same count-then-insert race,
--    so it moves here too (same rule, now locked).
create or replace function private.feedback_lock_user(uid uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  select pg_advisory_xact_lock(hashtextextended('jinx.feedback.' || uid::text, 0));
$$;
revoke all on function private.feedback_lock_user(uuid) from public, anon, authenticated;

create or replace function private.enforce_feedback_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  recent bigint;
begin
  if caller is not null and new.user_id is distinct from caller then
    raise exception using errcode = '42501', message = 'Feedback must belong to the signed-in user.';
  end if;
  perform private.feedback_lock_user(new.user_id);
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
revoke all on function private.enforce_feedback_rate_limit() from public, anon, authenticated;

create or replace function private.enforce_feedback_screenshot_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  recent bigint;
begin
  if not new.has_screenshot then
    return new;
  end if;
  if caller is not null and new.user_id is distinct from caller then
    raise exception using errcode = '42501', message = 'Feedback must belong to the signed-in user.';
  end if;
  perform private.feedback_lock_user(new.user_id);
  select count(*) into recent
  from public.feedback
  where user_id = new.user_id
    and has_screenshot
    and created_at > now() - interval '24 hours';
  if recent >= 5 then
    raise exception using
      errcode = 'P0001',
      message = 'Feedback screenshot limit reached: at most 5 screenshots per day.';
  end if;
  return new;
end;
$$;
revoke all on function private.enforce_feedback_screenshot_limit() from public, anon, authenticated;

-- Swap the old public trigger function for the locked private one.
drop trigger enforce_feedback_rate_limit on public.feedback;
drop function public.enforce_feedback_rate_limit();
create trigger enforce_feedback_rate_limit
before insert on public.feedback
for each row
execute function private.enforce_feedback_rate_limit();

create trigger enforce_feedback_screenshot_limit
before insert on public.feedback
for each row
execute function private.enforce_feedback_screenshot_limit();

-- 3. Private bucket for feedback pictures, separate from horse-screenshots.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feedback-screenshots', 'feedback-screenshots', false, 819200, array['image/jpeg']);

-- Storage policies run as the uploader, who cannot read public.feedback.
-- This helper can, and answers only "may the signed-in caller upload this
-- exact name?" for their own recent flagged report. It returns a boolean.
create or replace function private.feedback_screenshot_upload_allowed(object_name text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
begin
  if caller is null or object_name is null then
    return false;
  end if;
  return exists (
    select 1
    from public.feedback f
    where f.user_id = caller
      and f.has_screenshot
      and f.screenshot_path = object_name
      and f.created_at > now() - interval '1 hour'
  );
end;
$$;
revoke all on function private.feedback_screenshot_upload_allowed(text) from public, anon, authenticated;
grant execute on function private.feedback_screenshot_upload_allowed(text) to authenticated;

-- Write-once upload. No UPDATE or DELETE policy exists for this bucket, so
-- users cannot overwrite (upsert) or remove any feedback picture.
create policy "feedback_screenshots_insert_own_report"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'feedback-screenshots'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and private.feedback_screenshot_upload_allowed(name)
);

-- Read-back during the upload request only (INSERT ... RETURNING). Scoped to
-- the storage.object.upload operation, so it never matches list, download,
-- info, sign, copy or move requests.
create policy "feedback_screenshots_upload_returning"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'feedback-screenshots'
  and storage.allow_only_operation('storage.object.upload')
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and private.feedback_screenshot_upload_allowed(name)
);

commit;

-- Review queries for Renee (dashboard SQL editor, read-only):
--   Reports whose picture never arrived:
--     select f.id, f.created_at from public.feedback f
--     where f.has_screenshot and not exists (
--       select 1 from storage.objects o
--       where o.bucket_id = 'feedback-screenshots' and o.name = f.screenshot_path);
--   Pictures whose report is gone (e.g. a deleted account or a deleted row):
--     select o.name from storage.objects o
--     where o.bucket_id = 'feedback-screenshots' and not exists (
--       select 1 from public.feedback f where f.screenshot_path = o.name);
--   Delete such files from Storage in the dashboard (not with SQL), so the
--   stored bytes are removed too.
--
-- Rollback (only if Renee asks; empty the bucket in the dashboard first):
--   drop policy "feedback_screenshots_upload_returning" on storage.objects;
--   drop policy "feedback_screenshots_insert_own_report" on storage.objects;
--   drop function private.feedback_screenshot_upload_allowed(text);
--   delete from storage.buckets where id = 'feedback-screenshots';
--   drop trigger enforce_feedback_screenshot_limit on public.feedback;
--   drop function private.enforce_feedback_screenshot_limit();
--   -- restore the original 20/day trigger (from 20260927_feedback.sql):
--   drop trigger enforce_feedback_rate_limit on public.feedback;
--   drop function private.enforce_feedback_rate_limit();
--   drop function private.feedback_lock_user(uuid);
--   (re-run the rate-limit function + trigger section of 20260927_feedback.sql)
--   revoke insert (id, has_screenshot) on public.feedback from authenticated;
--   alter table public.feedback drop column screenshot_path, drop column has_screenshot;
