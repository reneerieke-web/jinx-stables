-- REVIEW ONLY — do not apply until Codex reviews it and Renee explicitly approves.
-- Plan: docs/screenshot-sync-plan.md (sections 1 and 2; decisions A, B, C = yes).
--
-- Creates one PRIVATE bucket for horse screenshots and owner-only policies.
--   * Bucket `horse-screenshots`: not public, 600 KB per file, image/jpeg only.
--   * Paths must be exactly  {auth.uid()}/{horse_id}/full.jpg  or  .../thumb.jpg
--   * Authenticated users may read, upload, overwrite (upsert), and delete only
--     inside their own folder. `anon` gets no policy, so it gets nothing.
--   * Uploads are refused once the user's folder holds 4,000 objects
--     (2 per horse x 2,000 horses).
--
-- Read-only checks run by Claude on 2026-09-27 before writing this file:
--   * storage.buckets was empty and storage.objects had no policies.
--   * All 78 existing horse ids match ^[A-Za-z0-9_-]{1,64}$ (longest is 16).
--
-- Known limit: the 4,000 cap is checked inside the INSERT policy, so two
-- uploads racing at exactly 3,999 objects could both pass. The overshoot is at
-- most a few files, and the per-file size limit still applies. A trigger on
-- storage.objects would close that gap, but Supabase advises against changing
-- the storage schema, so it is not done here.
--
-- Never delete storage.objects rows with SQL. Use the Storage API.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('horse-screenshots', 'horse-screenshots', false, 614400, array['image/jpeg']);

-- Shared path rule: first folder is the caller's user id, then one horse id,
-- then full.jpg or thumb.jpg. Rejects ../, extra folders, empty folders,
-- other users' folders, and any other file name.
create or replace function public.horse_screenshot_path_ok(object_name text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select object_name ~ (
    '^' || (select auth.uid())::text || '/[A-Za-z0-9_-]{1,64}/(full|thumb)\.jpg$'
  );
$$;

revoke all on function public.horse_screenshot_path_ok(text) from public;
revoke all on function public.horse_screenshot_path_ok(text) from anon;
grant execute on function public.horse_screenshot_path_ok(text) to authenticated;

create policy "horse_screenshots_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'horse-screenshots'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "horse_screenshots_insert_own"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'horse-screenshots'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.horse_screenshot_path_ok(name)
  and (
    select count(*)
    from storage.objects o
    where o.bucket_id = 'horse-screenshots'
      and o.name like (select auth.uid())::text || '/%'
  ) < 4000
);

-- Upsert (overwrite) needs SELECT + UPDATE in addition to INSERT.
create policy "horse_screenshots_update_own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'horse-screenshots'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'horse-screenshots'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and public.horse_screenshot_path_ok(name)
);

create policy "horse_screenshots_delete_own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'horse-screenshots'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

commit;

-- Rollback (only if Renee asks; run after the bucket is empty, via the Storage API):
--   drop policy "horse_screenshots_select_own" on storage.objects;
--   drop policy "horse_screenshots_insert_own" on storage.objects;
--   drop policy "horse_screenshots_update_own" on storage.objects;
--   drop policy "horse_screenshots_delete_own" on storage.objects;
--   drop function public.horse_screenshot_path_ok(text);
--   delete the empty bucket from the Storage dashboard.
