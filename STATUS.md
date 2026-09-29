# Jinx’s Stables — Project Status

Updated: September 28, 2026 (ET)

Three kinds of project memory live in this repository:

- `STATUS.md` (this file): where we are right now.
- Plans and records in `docs/`: what we are building and how it was tested (`docs/screenshot-sync-plan.md`, `docs/design-lab-plan.md` on the Design Lab branches, `docs/test-results.md`, `docs/known-limitations.md`, `docs/supabase-changes.md`, `docs/beta-tester-guide.md`).
- `docs/decisions.md`: why the architecture is the way it is. Read it before "improving" something that looks odd.

## Current state (read this first)

Verified on GitHub on September 28, 2026.

**Production and preview are the same build.** `main` (www.jinxsstables.com and jinxsstables.com) and `cloud-sync-preview` (the preview Worker) both point to `0781eca`. The move of `main` to `0781eca` was made with Renee's explicit approval after she tested the mobile Quick Add fix on a real iPhone (add, save, cross-device, delete), as recorded in the STATUS notes on the Design Lab branches.

**Live in production at `0781eca`:**

- Discord sign-in (Google sign-in is disabled) and a cloud-synced stable per account, with Recently deleted and a 30-day restore window.
- Database data limits: 2,000 horses per stable, 32 KB per horse record, 100-character stable names, with friendly in-app recovery.
- Security fixes: escaped and whitelisted horse tiers (tier XSS) and the SheetJS 0.20.3 spreadsheet reader with import limits.
- Screenshot sync across devices (private `horse-screenshots` bucket) and the cache-busting fix `061b812`.
- Text feedback ("Send feedback", insert-only).
- The mobile Quick Add fix `0781eca`.

**On branches, not deployed:**

| Work | Branch and head | State |
| --- | --- | --- |
| Optional feedback screenshots | `claude/focused-bardeen-ikb2lu` @ `71326c5` | SQL is review-only and **not applied**. Three open items before re-review: (1) rebase onto `0781eca`; (2) move the SECURITY DEFINER helpers into a dedicated `feedback_private` schema instead of a generic `private` schema; (3) make `tests/storage/run_feedback_parallel_test.sh` require exactly 5 committed reports and exit non-zero otherwise. |
| Design Lab v2 (desktop presentation experiment) | `claude/design-lab-v2` @ `ce4b651` | Built on Codex's `codex/design-lab-stable-ledger` @ `946cca2` (foundation `codex/design-lab-foundation` @ `c9166b4`). Presentation only. Awaits Codex review, then Renee's signed-in check on a preview. |
| Obsolete mobile fix | `codex/mobile-quick-add-fix` @ `0b4e6d8` | **Never merge.** Built on an old ancestor and replaced by `0781eca`. Safe to delete during housekeeping. |
| Welcome artwork track | `welcome-artwork-preview` @ `dc29f0b` | Frozen. Do not modify unless Renee asks. |

**Beta model.** Renee posted www.jinxsstables.com in three BDO guild Discords (community beta, started September 27). Anonymous visits cannot be measured. Signed-in testers can be counted from Supabase: as of September 28 the only signed-in account is Renee's (read-only check recorded on `claude/design-lab-v2`). Treat every tester's horses as real data from the moment they exist.

**Known limitations:** `docs/known-limitations.md`. **Supabase change log:** `docs/supabase-changes.md`. **Test history:** `docs/test-results.md`.

## Baton

- **Current builder:** Claude (baton handed over by Renee on September 27 because Codex was out of usage). Codex has since built the Design Lab foundation and v1 on its own `codex/` branches with Renee's direction.
- **Backup builder:** Codex.
- **Active branch:** `cloud-sync-preview` (`0781eca`).
- Only the baton holder writes to `cloud-sync-preview`. Work for review goes on its own `claude/<task>` or `codex/<task>` branch. When handing off, update this file in the same commit with the baton holder, last commit, completed work, next task, and anything that must not be touched.

## Team workflow

- Renee decides scope, approves consequential changes, and performs acceptance testing.
- The baton holder builds and commits.
- Whoever did not write a change reviews it before Renee tests it.
- Read-only (SELECT) lookups in Supabase are fine for verification. Anything that changes Supabase needs Renee's explicit yes, and only the baton holder makes it. Record every applied change in `docs/supabase-changes.md`.
- This repository is public. Never put secrets, credentials, private account information, emails, or account IDs in this file or anywhere else in the repository.

## Next

1. Review and merge this docs-only housekeeping branch (`claude/docs-housekeeping`).
2. Feedback screenshots: the three open items above, then Codex review. Renee decides separately whether and when to apply the SQL.
3. Design Lab v2: Codex review, then Renee's signed-in preview check (capsule counts match, editor round-trip in both views, narrow window falls back to cards, one horse with a picture and one without).
4. Delete `codex/mobile-quick-add-fix` when comfortable.
5. During the beta, only release blockers change production code. Usability items and ideas go to the backlog.
6. Still open from the security checklist: an end-to-end cross-account test through the app with a separate Discord test account.

After that:

- Add the privacy note to the site footer.
- Prevent iOS from offering "AutoFill Contact" on the horse Name field and the delete-confirmation name box.
- Ship the horse advisor, Keep this coat, and the screenshot color picker from Claude's `horse-advisor-and-coat-picker.diff` (suggestions only; see `docs/decisions.md`).
- Postponed on purpose: Google/Facebook login, advanced breeding tools, coat research, AI coat recognition, new themes, shared stables.

## Backlog

- A periodic pull while the app is visible, so an open device picks up other devices' changes (protected sync code; post-beta decision).
- Phone cards: show the camera badge.
- Phone editor: make the sticky Delete/Save bar opaque above scrolling content in every theme.
- Page the horse list the way screenshot cleanup is paged, before any stable approaches 1,000 horses (protected sync code; needs its own reviewed change).
- Let `pullCloudWhenSafe` pull unrelated remote updates while one oversized horse stays locally dirty.
- Automated test runs on GitHub (CI). Tests are run by hand today.
- Coat pairing planner using R/W/B catalog values, once enough horses have real coat codes (community color theory, label as unofficial).
- Optional White color group.
- Optional donation link ("help cover server costs"). Pearl Abyss confirmed on Sept 28 that a donation feature is allowed with a clear not-official/not-endorsed notice and no commercial use; the rules are in `docs/decisions.md` (D10). Not built yet.
- Photo identification (post-release): requirements in `docs/screenshot-sync-plan.md`; rules in `docs/decisions.md`.

## Decisions still open for Renee

- Whether to hide the Red/White/Black boxes in the editor.
- What "Ultimate horse" means for the advisor.
- Whether let-go suggestions should lean toward silver from the Horse Market or Flowers of Oblivion from Imperial delivery.
- Whether guests should be able to keep horses without signing in (this is why the pre-cloud migration test was not run).

## Do not touch

- Do not reset `cloud-sync-preview` or `main` to an older commit or discard later commits.
- Do not merge `codex/mobile-quick-add-fix` (`0b4e6d8`).
- Do not modify sync, authentication, or stored-data behavior during visual or layout work.
- Do not change Supabase (SQL, Storage, Auth settings) without Renee's explicit approval and the baton.
- Do not modify `main` or the frozen `welcome-artwork-preview` branch unless Renee explicitly requests it.
- Do not alter the connected custom domains or Supabase Auth URL configuration without Renee's explicit approval for each step.
- Do not change the fixed screenshot file names (`thumb.jpg` / `full.jpg`); see `docs/decisions.md`.
- Do not let a presentation experiment (Design Lab) own, copy, or persist horse data.
- Do not run live attack tests against Renee's real stable.
- Do not allow sample horses to persist locally, sync to a cloud stable, or appear in an upload prompt.

---

## History

The entries below are the running log kept since September 26. Each statement describes the state **at the time it was written**; for the current state, use the top of this file. Superseded notes removed on September 28: the "Production track: `main` at `61a2b41`, no screenshot sync" line, the matching baton lines, the "Screenshots stay on the device" tester note, and the "do not use Restore App Backup (JSON) on production" caution. That caution applied only while production (`61a2b41`) lacked screenshot sync; production now runs the same code as preview.

### Completed work (log)

- Launch Step 0 completed: authenticated GitHub repository access was restored and verified; the unpublished local commits `7540b39` and `3c0ae2b` were intentionally discarded, returning the local `cloud-sync-preview` branch to the shared `e564461` head.
- Cloud authentication and synchronization safety work is in place on `cloud-sync-preview`.
- Sample horses remain memory-only and are excluded from device-data upload prompts (`d71c01e`).
- Phone roster layout, filters, menus, editor sections, and Add Horse flow are implemented.
- Mobile editor horizontal drift is fixed (`1ced1d2`, finalized in `398e677`).
- Full coat appearance catalog is available (`cb7031c`).
- Advanced breeding color values are clearly labeled as optional community-documented information (`909cf41`).
- Coat fields are simplified into color group, standardized appearance, and automatically populated coat code (`4c596a3`).
- Desktop Option A header is implemented: cloud status left, centered title/count, Add Horse plus right-aligned menu; count wording now says “stable” (`398e677`).
- Claude verified `398e677` at desktop and phone sizes, including all 28 editor fields on phone.
- Moonlit, Autumn, Snowy, Desert, and Black Spirit use matching panel, border, accent, and muted-text palettes; Classic and Forest retain the original green (`c31c786`).
- The desktop header and phone editor Save bar now follow their active theme, while Dark, Amber, and Blue phone themes fully control their own panel colors (`15405c3`, authored by Claude, reviewed by Codex).
- Desert Sunset now reads as a sunset: violet sky fading through plum and rose to an orange horizon glow, with plum panels and a sunset-orange accent (`791d689`, authored by Claude, reviewed by Codex).
- Security checkpoint status: Mini declined the targeted audit and is no longer responsible for it. Codex completed a read-only code/configuration review of `e564461`; its unpublished `7540b39` commit was intentionally discarded after these findings were retained here. Ownership/RLS policies are structured correctly, anonymous users have no table access, signed-in users have no hard-delete grant, and no service-role key is in the page. Claude independently confirmed those same four points.
- Tier XSS is fixed (`77a17b0`): restored/imported tiers are restricted to `TIER_LABEL`, and the tier badge is escaped before HTML rendering. Claude’s exploit test fired before the fix and zero times afterward on desktop and phone; a real full-stable backup retained every valid tier.
- SheetJS is upgraded from 0.18.5 to the 0.20.3 core build (`6543f03`), with 5 MB and 2,000-row import limits and formulas/HTML disabled while parsing. Codex downloaded the official file from `cdn.sheetjs.com`; it and the embedded copy are byte-for-byte identical at 507,212 bytes with SHA-256 `197255b0c278588117e45c14c1b25398562864cd9ffa9752c4b4d29f6d9bfd27`.
- Launch Step 2 completed: `https://jinxsstables.com` and `https://www.jinxsstables.com` are included in `CLOUD_ALLOWED_ORIGINS`, ready for the later custom-domain connection.
- Launch Step 3 approved for production: Renee tested the preview on phone and desktop, and both exported workbooks matched exactly at 77 horses, 67 columns, and identical cell contents.
- Launch Step 3 completed: `main` was fast-forwarded to the approved release at `b3175a8`. Production displayed the current welcome screen and Discord sign-in, and Renee confirmed the signed-in production stable on both phone and desktop with 77 total horses.
- Launch Step 4, Cloudflare apex completed: with Renee's approval, `jinxsstables.com` was connected to the Production `jinx-stables` Worker. HTTPS was verified live with a `200 OK` response.
- Launch Step 4, Cloudflare `www` completed: with Renee's separate approval, `www.jinxsstables.com` was connected to the Production `jinx-stables` Worker. HTTPS was verified live with a `200 OK` response. Both Cloudflare custom domains are now attached.
- Launch Step 4, Supabase Auth completed: with Renee's separate approval, the Site URL was changed to `https://jinxsstables.com`, and exact redirect URLs for `https://jinxsstables.com` and `https://www.jinxsstables.com` were added while retaining both existing workers.dev redirect URLs.
- Launch finished: Renee signed in successfully at `https://jinxsstables.com`, confirmed all 77 horses, and confirmed the cloud save completed.
- Pearl Abyss's recommended fan-content statement was added verbatim to the site footer and welcome-screen disclaimer while retaining the existing “Independent fan-made tool…” wording. Renee approved the exact wording for production.
- The stray Google-provider test account and its empty stable were deleted after Renee confirmed the exact target. The Discord account and its 77-horse stable were verified intact, and Google Auth was disabled with Renee's approval.
- Claude approved the proposed data-limit SQL after replica tests covering the 2,000-row boundary, existing-row upserts at the limit, 32 KB horse data, 100-character stable names, RLS isolation, and direct function-call denial.
- App-side limit handling now keeps an unsaved limit-rejected horse local and editable during account connection, excludes UTF-8 snapshots over 26,000 bytes without blocking other queued saves, names excluded horses in a phone-visible banner, and explains that Recently deleted horses count toward 2,000 until their 30-day purge. Claude approved this protected sync change before SQL application.
- Data-limit Step 1 completed: after Claude's approval, `main` was fast-forwarded to `61a2b41`. The production branch now contains the protected app-side handling before the database limits are applied.
- Data-limit Step 2 completed: with Renee's approval, she ran `supabase/review/20260927_data_size_limits.sql` in the production Supabase SQL Editor. Supabase reported `Success. No rows returned`, confirming that the transaction committed without an SQL error.
- Data-limit Step 3 verified read-only by Claude: both CHECK constraints exist and are validated; `enforce_horses_per_stable_limit` is enabled on `public.horses` as a BEFORE INSERT trigger; function EXECUTE is limited to `postgres` and `service_role`; and all 77 existing horse rows pass, with a maximum stored JSON size of 2,470 bytes. Production `main` remains at `61a2b41`, so the app-side limit handling was live before database enforcement began.
- Screenshot sync plan approved by Renee with decisions A, B, C = yes; committed as `docs/screenshot-sync-plan.md` (`8f4116d`).
- Warning overlap fixed by Claude (`35da65f`, on `claude/cloud-limit-warning-fix`, awaiting Codex review): the header `#cloudStatus` now says only "Cloud save blocked" and the full message lives only in `#cloudLimitBanner`. Regression test added; overlap reproduced at 1280 and 700 px on the old code and gone after; phone header unchanged.
- Codex approved the warning fix and merged Claude's branch into `cloud-sync-preview` at `e48781f` (tests pass; `main` untouched).
- Storage SQL revision 2 (`264d7bf`, **not applied**): Codex found revision 1 (`c74681c`) counted `storage.objects` inside its own policy; Claude reproduced "infinite recursion" on the first upload. Uploads now require a live horse row in the caller's own stable, so the 2,000-horse limit caps storage at 4,000 objects. Local replica tests (`tests/storage/`) pass 27/27. Known gap: files of horses purged after 30 days remain until orphan cleanup.
- Storage SQL stays at revision 2 (Renee's decision, Sept 27, on Mini's recommendation). A versioned-file revision 3 was drafted and withdrawn to keep the hard bound of two files per horse. Accepted limitation: two devices uploading different pictures of the same horse at the same moment can mismatch thumbnail and full image; adding the picture again fixes it. The file bound (4,000 per account, about 2.4 GB) is not free-plan protection by itself; watch storage usage.
- Codex approved `264d7bf` and `3a4d00e` with no blocking findings; Claude fast-forwarded `cloud-sync-preview` to include them. The SQL is still **not applied**.
- **Storage SQL applied (Sept 27, 10:35 AM ET)** with Renee's explicit approval: Claude ran the exact reviewed file from `cloud-sync-preview` (`2cf585a`, SHA-256 `20098208…c9c5bb`) in one transaction. Read-only verification: bucket `horse-screenshots` is private, 600 KB, image/jpeg only; exactly the four owner policies exist (SELECT/INSERT/UPDATE/DELETE, role authenticated); `horse_screenshot_upload_ok` is SECURITY INVOKER with an empty search_path, EXECUTE for authenticated (not anon); 0 storage objects; all 78 horse rows intact. Supabase security advisor shows only the known leaked-password warning (not applicable, Discord-only).
- **Storage cross-account test PASSED (Sept 27, ~10:45 AM ET)**, run by Claude with Renee's approval as two simulated signed-in users inside forced-rollback transactions (direct-delete guard `storage.allow_delete_query` enabled only inside the test, as the Storage API does). 32 checks: own uploads, both replace paths (upsert on the real `(bucket_id, name, version)` key and plain update), reads and deletes succeed; soft-deleted, unknown and other-user horse ids, other-user folders, `../`, extra folder, empty folder, other names and PNG are refused; A cannot list, edit, overwrite (upsert or update), move into, or delete B's files; signed-out visitors see nothing, cannot upload, and cannot run the path-check function. Two first-run failures were test-query mistakes (wrong conflict key; an unexecuted function call) and passed when corrected. Afterward: 1 user, 1 stable, 78 horses, 0 stored objects, no test rows left.
- **Real-device screenshot tests PASSED (Sept 27, Renee; iPhone Safari + Windows Chrome, preview site):** two-way sync (6 horses); replace both directions; remove and re-add both directions; delete → Recently deleted → Restore keeps the picture on both devices (CaramelMeringue); offline remove syncs after reconnect; offline upload of an iPhone camera photo uploads after reconnect (cloud files and pointer confirmed read-only); iPhone camera photos (the HEIC question) display on Windows Chrome; logout/login returns the full stable (48 active / 77 total).
- **Stale-picture bug found and fixed:** after a Replace, normal Chrome kept showing the old picture even after a full reload while Incognito showed the new one. Cause: fixed file names meant the same download URL, and a cached response was saved under the new version. Fix `061b812` (Codex approved, no SQL/Supabase changes): downloads pass `cacheNonce=<version>`, and older cached copies are re-fetched once. Verified live: the stuck copy corrected itself, and a fresh phone Replace (PralineKnot) showed on normal Chrome after reload.
- Updated screenshot sync plan committed to `docs/screenshot-sync-plan.md` (adds Dream/Mythical skip, portrait color tip, zoom, OCR later).
- Data-limit Step 4 passed live from start to finish: ButterBean saved with Caution turned off at 2:27 AM; the oversized SIZE TEST snapshot never reached the cloud; after its notes were fixed, the warning cleared as intended; and SIZE TEST was deleted into Recently deleted for the normal 30-day purge. The database limits and app-side recovery are live without locking the user out.
- **Mobile Quick Add release-blocker fix prepared for review (Sept 27):** an isolated patch was rebuilt directly on `cloud-sync-preview` at `1e82939` after the first review branch was found to be based on old production. It adds phone-safe 16 px controls, desktop-only Name autofocus, button `touch-action: manipulation`, a two-column phone skill layout, a wrapping/reachable action footer, and dynamic modal height/horizontal-overflow protection, plus dedicated structural and Playwright tests. The four available non-browser suites pass; the rendered Playwright matrix still needs Chrome/Chromium. This review branch is not merged or deployed; `main`, Supabase, SQL, storage policies, and production are untouched.

### Security checkpoint (log)

- **Tier XSS: FIXED AND REVIEWED.** A crafted JSON backup or transfer file could previously place an unescaped value in the card tier badge. `mk()` now accepts only tiers listed in `TIER_LABEL` (anything else becomes Tier 8), and `cardBody()` escapes the badge value.
- **Spreadsheet reader: FIXED AND REVIEWED.** SheetJS 0.18.5 was replaced by the verified official-equivalent 0.20.3 core build. Imports over 5 MB or 2,000 rows are refused with a clear message; parsing stops at the limit and skips formulas and HTML. Claude tested the real 77-row roster, oversized XLSX/CSV files, and export equivalence.
- **Cross-account isolation: PASSED.** With Renee’s approval, Claude ran 26 attacks as a simulated second authenticated user inside a forced-rollback transaction. Cross-account horse and stable reads/writes, ownership changes, deletes, truncate, `auth.users` access, and anonymous access were all blocked. Control checks showed the simulated user could still use its own stable. Renee’s before/after fingerprints matched, and no test users remained.
- **Non-blocking:** Supabase leaked-password protection is off, which is not applicable while sign-in is Discord-only.

### Domain deployment (completed Sept 26–27)

Connected together, each with Renee's approval: the Cloudflare custom domains on the `jinx-stables` Worker, `CLOUD_ALLOWED_ORIGINS` in `public/index.html`, and the Supabase Site URL and redirect URLs (see `docs/supabase-changes.md`).
