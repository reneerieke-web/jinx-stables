# Screenshot sync plan

Author: Claude. Plan approved by Renee on September 27, 2026 (decisions A, B, C = yes).
Builder: whoever holds the baton in STATUS.md (Claude took it on September 27 while Codex was out of usage). Nothing in Supabase is applied until Renee explicitly approves that step.

## Goal
A screenshot added on one device shows up on the user's other devices. Screenshots stay private to their owner. Horse sync behavior does not change.

## Today (verified in code)
- Screenshots live only in the browser's IndexedDB (`jinxStablesMedia` / `screenshots`), keyed by horse id.
- Each one is stored as two JPEG data URLs: `full` (max 1600 px, quality 0.85) and `thumb` (max 320 px, quality 0.75).
- They are not in the horse data, the cloud, or backups.

## Design

### 1. Storage (Supabase Storage)
- One **private** bucket: `horse-screenshots`. Not public, no public URLs.
- Bucket limits: `file_size_limit` 600 KB, `allowed_mime_types` = `image/jpeg`.
- File paths: `{auth.uid()}/{horse_id}/full.jpg` and `{auth.uid()}/{horse_id}/thumb.jpg`.
  The first folder is always the owner's user id, which keeps the security rules simple.

### 2. Security rules (RLS on `storage.objects`)
For role `authenticated`, bucket `horse-screenshots` only:
- SELECT, INSERT, UPDATE, DELETE allowed only when `(storage.foldername(name))[1] = (select auth.uid())::text`.
- INSERT also requires the user's folder to hold fewer than 4,000 objects (2 per horse, 2,000 horses).
- `anon` gets nothing.
- Deleting your own screenshot files is allowed (they are replaceable, unlike horse rows).

### 3. Horse data pointer
- Add `screenshot` to the horse record: `{ "v": "<upload timestamp>" }` or `null`.
- It rides along in normal horse sync. No new table.
- Other devices compare `v` with their local cache and download only when it changed.
- `mk()` must keep this field.

### 4. Upload flow (order matters)
1. User picks an image. Compress: `full` max **1280 px**, JPEG quality 0.8. If still over 500 KB, retry at 0.7, then 0.6. `thumb` 320 px, 0.7.
2. Save to IndexedDB right away (works offline, same as today).
3. Put an entry in a **persisted upload queue** (localStorage, per user).
4. Upload `thumb.jpg` and `full.jpg` (`upsert: true`).
5. **Only after both uploads succeed**, set `horse.screenshot.v` and let normal horse sync save it.
   So no device ever sees a pointer to a file that is not there yet.
6. Failures stay queued and retry with backoff. A rejected file (too big, wrong type) shows the same kind of banner as the data limits, naming the horse.

### 5. Download flow
- Card camera badge comes from `horse.screenshot` (no network).
- Editor opens: if the local cache is missing or has an old `v`, download `thumb.jpg` through the signed-in client and cache it.
- Tap to view full size: download `full.jpg` then, not before.
- Signed URLs (if used) expire in 60 minutes or less.

### 6. Removing a screenshot
- "Remove" in the editor: delete both files, set `horse.screenshot = null`, clear local cache. Other devices clear theirs when they see `null`.
- Deleting a horse (soft delete) keeps its screenshot so **Restore** brings it back.
- After the 30-day purge, the files are orphaned. Cleanup of orphans is a later task (tiny cost). Do not delete `storage.objects` rows with SQL; use the Storage API.

### 7. Existing local screenshots (one-time)
- After sign-in, if the device has local screenshots for horses in the user's cloud stable that have no `horse.screenshot`, show a one-time prompt: "Upload N screenshots from this device so your other devices can see them?" Upload only on Yes.

### 8. Guest mode
- Signed-out (local-only) use stays exactly as today: IndexedDB only.

### 9. Picture front and center (Renee's request)
- Move the Screenshot box to the **top of the editor**, right under the horse's name, so opening a horse shows its picture first.
- Show the small thumbnail on the horse's **card** too (phone and desktop), when one exists.
- Same picture on every device once synced (sections 3 to 5).

### 10. Identify the coat on first view (suggestions only)
When a horse gets a new picture, the editor asks: "Tap the horse's body to identify its color."
1. The tap samples the color (Claude's coat picker code, already written and tested) and suggests a **color group**.
2. The app then filters the coat catalog to **this horse's tier and that color group** and shows a short list of matching coat codes with descriptions, for example "T8C: silver/blue-gray, dark mane."
3. The user taps the one that matches, which fills in the coat code and description through the existing dropdown. Or they choose "None of these."
4. Nothing is filled in without a tap.

Honest limits:
- The app **cannot reliably pick the exact code by itself.** Many coats in a tier share a body color and differ only in mane, spots, or dapples, and the catalog descriptions are still low-confidence guesses. So it narrows the list; the player makes the call.
- True picture recognition would mean sending screenshots to an outside AI service (cost, privacy, and it still needs verified reference pictures). Not planned.
- As players confirm coats, the catalog gets more accurate and the short lists get better.

## Security test before release (Claude runs, rolled back or on test users only)
1. User B cannot list, download, upload to, overwrite, or delete anything in user A's folder.
2. Anon cannot read or list the bucket; public URLs fail.
3. Path tricks (`../`, a different first folder, empty folder) are rejected.
4. A 700 KB file is rejected; a PNG or non-image is rejected.
5. The 4,000-object cap is enforced.
6. Horse sync still passes the existing isolation checks.

## Cost check
Roughly 150 to 300 KB per horse (full + thumb). The free plan's 1 GB holds about 3,000 to 6,000 screenshots across all users. Claude will report usage on request.

## Order of work
1. Codex: fix the warning text overlapping the title (already logged). Small, ships first.
2. Codex: migration for bucket + storage policies, sent to Claude for review, not applied.
3. Codex: app changes (sections 3 to 7) on `cloud-sync-preview`, sent to Claude for review.
4. Renee approves, migration applied, Claude runs the security test.
5. Renee tests: add a screenshot on the computer, see it on the phone; remove it, see it vanish.
6. Fast-forward `main`.
7. Then sections 9 and 10 (picture at top, card thumbnail, identify-on-first-view), built on top of Claude's horse-advisor-and-coat-picker patch.

## Decisions for Renee
Decided by Renee on September 27, 2026:
- A. **Yes.** Offer a one-time upload of existing device screenshots (section 7), with the prompt.
- B. **Yes.** Keep a deleted horse's screenshot for the 30 days so Restore brings it back.
- C. **Yes.** Full-size screenshot capped at 1280 px.

## Progress
- Order of work step 1 (warning overlap) done by Claude on `claude/cloud-limit-warning-fix`, for Codex review.
- Step 2 migration written by Claude as review-only `supabase/review/20260927_screenshot_storage.sql`. Not applied.
