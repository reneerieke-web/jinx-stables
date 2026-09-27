-- REVIEW ONLY — do not apply until Codex reviews it and Renee explicitly approves.
-- Optional screenshot on a beta feedback report. Builds on the applied
-- 20260927_feedback.sql (insert-only feedback table); changes nothing there
-- except two new columns, a wider INSERT grant, and one more trigger.
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
--   * Testers can upload exactly one picture per flagged report of their own,
--     and nothing else: no reading, listing, replacing, or deleting any
--     feedback picture, including their own. anon gets nothing.
--   * The stored path is a generated column (user id + report id), so a user
--     cannot point a report at any other file.
--   * Renee reviews in the dashboard (Storage > feedback-screenshots, or a
--     signed URL). The dashboard / service role bypasses RLS; nothing here
--     grants users read access.
--
-- Abuse and cost:
--   * Bucket: private, image/jpeg only, 800 KB per file (the app aims for
--     under 700 KB; screenshots compress far below that).
--   * At most 5 reports with a screenshot per user per 24 hours (on top of the
--     existing 20 reports/day), and one file per report, so the worst case is
--     about 4 MB per user per day.
--   * A picture can only be uploaded within an hour of its report.

begin;

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

-- 2. At most 5 screenshot reports per user per 24 hours.
create or replace function public.enforce_feedback_screenshot_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent bigint;
begin
  if not new.has_screenshot then
    return new;
  end if;
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

revoke all on function public.enforce_feedback_screenshot_limit() from public, anon, authenticated;

create trigger enforce_feedback_screenshot_limit
before insert on public.feedback
for each row
execute function public.enforce_feedback_screenshot_limit();

-- 3. Private bucket for feedback pictures, separate from horse-screenshots.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('feedback-screenshots', 'feedback-screenshots', false, 819200, array['image/jpeg']);

-- Storage policies run as the uploader, who cannot read public.feedback.
-- This helper can, and answers only "may I upload this exact name?" for the
-- caller's own recent flagged report. It returns a boolean and nothing else.
create or replace function public.feedback_screenshot_upload_allowed(object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.feedback f
    where f.user_id = (select auth.uid())
      and f.has_screenshot
      and f.screenshot_path = object_name
      and f.created_at > now() - interval '1 hour'
  );
$$;

revoke all on function public.feedback_screenshot_upload_allowed(text) from public, anon;
grant execute on function public.feedback_screenshot_upload_allowed(text) to authenticated;

-- INSERT only. No SELECT, UPDATE or DELETE policy exists for this bucket, so
-- users cannot list, download, overwrite (upsert) or remove any feedback
-- picture, their own included. A second upload to the same name fails.
create policy "feedback_screenshots_insert_own_report"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'feedback-screenshots'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.feedback_screenshot_upload_allowed(name)
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
--   drop policy "feedback_screenshots_insert_own_report" on storage.objects;
--   drop function public.feedback_screenshot_upload_allowed(text);
--   delete from storage.buckets where id = 'feedback-screenshots';
--   drop trigger enforce_feedback_screenshot_limit on public.feedback;
--   drop function public.enforce_feedback_screenshot_limit();
--   revoke insert (id, has_screenshot) on public.feedback from authenticated;
--   alter table public.feedback drop column screenshot_path, drop column has_screenshot;
