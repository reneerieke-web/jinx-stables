-- REVIEW ONLY — do not apply until Codex reviews it and Renee explicitly approves.
-- Plan: docs/screenshot-sync-plan.md (sections 1 and 2; decisions A, B, C = yes).
--
-- Creates one PRIVATE bucket for horse screenshots and owner-only policies.
--   * Bucket `horse-screenshots`: not public, 600 KB per file, image/jpeg only.
--   * Paths must be exactly  {auth.uid()}/{horse_id}/{version}-full.jpg
--     or  {auth.uid()}/{horse_id}/{version}-thumb.jpg  (version: 1-40 of A-Z a-z 0-9 _ -)
--   * Upload/overwrite is allowed only when {horse_id} is a live (not soft-deleted)
--     horse row in the caller's own stable. Read and delete are allowed anywhere
--     inside the caller's own folder, so Restore and later orphan cleanup work.
--   * `anon` gets no policy, so it gets nothing.
--
-- Revision 3 (after Codex review of the app, d741432):
--   * Versioned, immutable file names. Each upload writes a new
--     {version}-thumb.jpg / {version}-full.jpg pair and the horse's pointer
--     names that version, so a thumbnail and full image always come from the
--     same picture even if two devices upload at the same moment. The app
--     deletes older versions after the new pointer is confirmed, and the
--     daily cleanup removes any that were missed.
--   * Consequence: the fixed 4,000-object ceiling from revision 2 no longer
--     holds; a horse can briefly hold more than one version. Revision 2's
--     ceiling was also not quota protection (4,000 x 600 KB = 2.4 GB, more
--     than the free plan's 1 GB), so storage use is protected the same way
--     as before in practice: 600 KB per file, owner-only folders, live-horse
--     rule, version cleanup, and Supabase usage monitoring.
--
-- Revision 2 (after Codex review of c74681c):
--   * Removed the 4,000-object count, which queried storage.objects from inside a
--     storage.objects policy and also blocked overwrites at exactly 4,000.
--   * (Superseded by revision 3.) The cap came from the horse-row rule: one horse id allowed only
--     full.jpg and thumb.jpg, and a stable holds at most 2,000 horse rows
--     (enforce_horses_per_stable_limit), so live uploads cap at 4,000 objects.
--   * Known gap: files of a horse purged after 30 days stay behind until orphan
--     cleanup (a later task, plan section 6) and do not count toward that cap.
--
-- App consequence (plan section 4): the upload queue must wait until the horse
-- row has reached the cloud; uploading for an unsynced horse is refused.
--
-- Ownership join checked read-only against production on 2026-09-27:
--   public.stables(id uuid pk, owner_id uuid -> auth.users, unique per owner)
--   public.horses(stable_id uuid -> stables, id text, deleted_at timestamptz,
--                 primary key (stable_id, id))
--   All existing horse ids match ^[A-Za-z0-9_-]{1,64}$.
--
-- Never delete storage.objects rows with SQL. Use the Storage API.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('horse-screenshots', 'horse-screenshots', false, 614400, array['image/jpeg']);

-- True only for {caller uid}/{live horse id in caller's stable}/{version}-(full|thumb).jpg.
-- security invoker: the lookup runs under the caller's own RLS on stables and
-- horses, so it can never see another user's rows.
create or replace function public.horse_screenshot_upload_ok(object_name text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select
    object_name ~ (
      '^' || (select auth.uid())::text || '/[A-Za-z0-9_-]{1,64}/[A-Za-z0-9_-]{1,40}-(full|thumb)\.jpg$'
    )
    and exists (
      select 1
      from public.horses h
      join public.stables s on s.id = h.stable_id
      where s.owner_id = (select auth.uid())
        and h.id = split_part(object_name, '/', 2)
        and h.deleted_at is null
    );
$$;

revoke all on function public.horse_screenshot_upload_ok(text) from public;
revoke all on function public.horse_screenshot_upload_ok(text) from anon;
grant execute on function public.horse_screenshot_upload_ok(text) to authenticated;

create policy "horse_screenshots_select_own"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'horse-screenshots'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

create policy "horse_screenshots_insert_own_horse"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'horse-screenshots'
  and public.horse_screenshot_upload_ok(name)
);

-- Upsert (overwrite) needs SELECT + UPDATE in addition to INSERT.
create policy "horse_screenshots_update_own_horse"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'horse-screenshots'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'horse-screenshots'
  and public.horse_screenshot_upload_ok(name)
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

-- Rollback (only if Renee asks; empty the bucket first via the Storage API):
--   drop policy "horse_screenshots_select_own" on storage.objects;
--   drop policy "horse_screenshots_insert_own_horse" on storage.objects;
--   drop policy "horse_screenshots_update_own_horse" on storage.objects;
--   drop policy "horse_screenshots_delete_own" on storage.objects;
--   drop function public.horse_screenshot_upload_ok(text);
--   then delete the empty bucket from the Storage dashboard.
