# Jinx’s Stables — Project Status

Updated: September 28, 2026 (ET)

## Baton

- **Current builder:** Claude (baton handed over by Renee on September 27 because Codex is out of usage)
- **Backup builder:** Codex
- **Claude's working branch:** none open. Latest completed application work is included in `cloud-sync-preview` and production through `0781eca6`.
- **Pending review:** `codex/design-lab-stable-ledger` contains the first desktop-only Design Lab interpretation on top of the approved foundation. It is isolated, not merged, and not deployed.
- **Design Lab v2 (Claude, Sept 28):** Stable Ledger v2 on `claude/design-lab-v2` (built on `946cca2`): management-ledger density, restored Courser/status/coat facts, small thumbnails, no redundant link. Presentation only; same data boundary. Not merged or deployed; needs Codex review, then Renee's signed-in preview check. See `docs/design-lab-plan.md`.
- **Active branch:** `cloud-sync-preview`
- **Last code commit:** `0781eca6` — reviewed mobile Quick Add viewport/action fix on top of the screenshot-sync and feedback release.
- **Production head:** `main` was fast-forwarded to `0781eca6` with Renee's explicit approval; both custom domains were verified serving the release.
- **Review status:** mobile Quick Add passed Renee's real-iPhone add/save/cross-device/delete test before production promotion. The Design Lab Stable Ledger now awaits visual/code review on its isolated branch.

Only the baton holder writes to `cloud-sync-preview`. When handing off, update this file in the same commit with the new baton holder, last commit, completed work, next task, and anything that must not be touched.

## Design Lab experiment (branch only)

- Branch: `codex/design-lab-stable-ledger`, built on the reviewed foundation commit `c9166b46`, which is based directly on `cloud-sync-preview` at `0781eca6`.
- Purpose: establish guardrails for a future desktop-only alternate roster presentation while keeping the current roster as the control.
- Plan: `docs/design-lab-plan.md`.
- Current state: first desktop-only Stable Ledger interpretation implemented for review. Current Roster remains the default control; no merge or deployment has occurred.
- Standalone reference: `prototypes/design-lab-stable-ledger.html` demonstrates the proposed borderless Stable Ledger visual language and a safe renderer-adapter shape. It is outside `public/`, disconnected from the app, and uses only frozen preview examples.
- Hard boundary: Design Lab must render the existing `horses` objects after the existing capsule/filter/search/sort selection. It must not create, copy, migrate, transform, seed, sync, or persist a second horse collection.
- Editing boundary: horse activation must use the existing `openEditor(h.id)` editor. The experimental renderer does not gain direct mutation controls.
- Mobile boundary: no entry or alternate renderer at the existing `max-width: 640px` phone breakpoint; the current mobile experience and Quick Add remain untouched.
- No changes to `main`, production, Supabase, SQL, Storage, authentication, screenshot sync, feedback, Recently Deleted, import/export, IDs, schemas, or persistence/cloud-sync behavior.
- This branch must not be merged or deployed until Renee separately approves an actual visual direction and the resulting UI receives normal review and regression testing.

## Team workflow

- Read-only (SELECT) lookups in Supabase are fine for verification; anything that changes Supabase needs Renee's yes.

- Renee decides scope, approves consequential changes, and performs acceptance testing.
- The baton holder builds and commits.
- Whoever did not write a change reviews it before Renee tests it.
- Claude may inspect Supabase, but only the baton holder may change Supabase, and only with Renee’s explicit approval.
- This repository is public. Never put secrets, credentials, private account information, or personal information in this file or anywhere else in the repository.

## Done

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

## Security checkpoint

- **Tier XSS: FIXED AND REVIEWED.** A crafted JSON backup or transfer file could previously place an unescaped value in the card tier badge. `mk()` now accepts only tiers listed in `TIER_LABEL` (anything else becomes Tier 8), and `cardBody()` escapes the badge value.
- **Spreadsheet reader: FIXED AND REVIEWED.** SheetJS 0.18.5 was replaced by the verified official-equivalent 0.20.3 core build. Imports over 5 MB or 2,000 rows are refused with a clear message; parsing stops at the limit and skips formulas and HTML. Claude tested the real 77-row roster, oversized XLSX/CSV files, and export equivalence.
- **Cross-account isolation: PASSED.** With Renee’s approval, Claude ran 26 attacks as a simulated second authenticated user inside a forced-rollback transaction. Cross-account horse and stable reads/writes, ownership changes, deletes, truncate, `auth.users` access, and anonymous access were all blocked. Control checks showed the simulated user could still use its own stable. Renee’s before/after fingerprints matched, and no test users remained.
- **Non-blocking:** Supabase leaked-password protection is off, which is not applicable while sign-in is Discord-only.

## Next

### Design Lab (isolated branch only)

- A first desktop-only Stable Ledger interpretation is in progress on the isolated Design Lab branch. It is not merged or deployed.
- `renderGrid()` selects one `visibleHorses` array and passes those same horse object references to either the untouched Current Roster renderer or the Design Lab renderer. Design Lab has no horse collection, save path, schema, storage key, or sync behavior of its own.
- Current Roster remains the default control. Design Lab is a session-only desktop presentation toggle and is forced off at 640 px and below.
- Design Lab rows open the existing `openEditor(horse.id)`. Horses with cached screenshots receive a landscape-photo treatment; horses without screenshots receive compact typography-only rows rather than empty photo boxes. Dream/Mythical designation is understated text, not extra pills.
- This work must remain separate from feedback-screenshot/Supabase work and must not touch `main`, production, SQL, Storage, authentication, screenshot sync behavior, imports, Recently Deleted, or horse persistence.
- Full guardrails and rollback/promotion rules: `docs/design-lab-plan.md`. Standalone visual reference: `prototypes/design-lab-stable-ledger.html`.

Release sequence (agreed Sept 27; finish what is built, no new features):

1. ~~Apply the storage SQL~~ Done Sept 27 (see Done).
2. Security: ~~Claude's database-level storage test~~ passed Sept 27 (see Done). Still to do: Mini's live test through the app with a separate Discord test account.
3. ~~Real-device tests~~ passed Sept 27 (see Done), including the stale-picture fix `061b812`.
4. Migration test: **not tested.** A new visitor cannot create or keep a local stable without signing in, so an authentic pre-cloud local roster could not be reproduced. Renee decided not to build a guest workflow just for this test. Whether guests should keep horses without signing in is a later product decision.
5. **NOW: community beta** (started Sept 27; unknown tester count). Renee shared www.jinxsstables.com in three BDO guild Discords. Two tracks:
   - **Production track:** www.jinxsstables.com serves Production (`main` at `61a2b41`: Discord sign-in, cloud saving, data limits, security fixes; screenshots stay on the device they were added on, no sync). Feedback from here counts as general/core-app community beta feedback. Production stays untouched during beta.
   - **Preview track:** `https://cloud-sync-preview-jinx-stables.renee-rieke.workers.dev/` serves `cloud-sync-preview` (screenshot sync and the cache fix `061b812`, plus docs). Renee shares this link separately when she wants testers on screenshot sync and new features. Tester guide: `docs/beta-tester-guide.md`.
   - Both tracks use the same Supabase database, so a tester's stable is the same on both. Only release blockers change code during beta. Do not use "Restore App Backup (JSON)" on Production (it drops picture links).
6. Fix release blockers only; record usability items and ideas.
7. Release-candidate freeze: one exact `cloud-sync-preview` SHA. Nobody changes it. Claude reviews, Codex reviews, Renee and testers test that SHA.
8. Fast-forward `main` to that exact SHA.

Caution while preview and production share the same data: do not use "Restore App Backup (JSON)" on production, because production code drops picture links on restore. Normal editing is fine.

Other items, after the release:
- Add the privacy note to the site footer.
- Prevent iOS from offering "AutoFill Contact" on the horse Name field **and** the delete-confirmation name box.
- Ship the horse advisor, Keep this coat, and screenshot color picker from Claude's `horse-advisor-and-coat-picker.diff`.
- Postponed on purpose: Google/Facebook login, advanced breeding tools, coat research, AI coat recognition, new themes, shared stables. The welcome artwork stays on its own `welcome-artwork-preview` track.

## Backlog

Usability notes from real-device testing (not blockers; for the timeboxed polish pass unless marked otherwise):
- A device that stays open and focused does not pick up another device's changes until you switch back to it or reload. Existing horse-sync behavior (pull on focus/visibility). A periodic pull while visible would fix it; protected sync code, post-beta decision.
- Phone cards do not show the camera badge (desktop does).
- Phone editor: headings show through the sticky Delete/Save bar; make it opaque above scrolling content in every theme (390 px, Dark/Amber/Blue).
- Photo identification (post-release) requirements are recorded in `docs/screenshot-sync-plan.md`.
- No CI runs the tests on GitHub; they are run locally by Claude and Codex. Optional later improvement.

- **Pre-existing (found during screenshot review, not changed):** `fetchCloudRoster()` and `pullCloudWhenSafe()` read horses in one request. The API returns at most 1,000 rows, while stables may hold 2,000, so a stable over 1,000 horses would only show 1,000 on a device. No cloud data is deleted by this, but it should be paged like the screenshot cleanup before any stable approaches 1,000 horses. Protected sync code: needs its own reviewed change.

- Coat pairing planner using R/W/B catalog values, once enough horses have real coat codes (community color theory, label as unofficial).
- Optional White color group.
- Optional donation button, after confirming the implementation follows Pearl Abyss's fan-content requirements.
- Improve `pullCloudWhenSafe` so unrelated remote updates can still be pulled while one oversized horse remains locally dirty; current behavior safely pauses pulls until the blocked horse is fixed.

## Tester invite note

- Screenshots stay on the device you add them on for now.

## Decisions still open for Renee

- Whether to hide the Red/White/Black boxes in the editor.
- What “Ultimate horse” means for the advisor.
- Whether let-go suggestions should lean toward silver from the Horse Market or Flowers of Oblivion from Imperial delivery.

## Domain deployment

When `jinxsstables.com` is connected, update these three items together:

1. Cloudflare custom domain on the `jinx-stables` Worker.
2. `CLOUD_ALLOWED_ORIGINS` in `public/index.html`.
3. Supabase Site URL and redirect URLs.

## Do not touch

- Do not reset `cloud-sync-preview` to `909cf41` or discard later commits.
- Do not apply Claude’s old `header-and-themes.diff`; `398e677` replaces its header work.
- Do not replace the current file with Claude’s attached full `index.html`; only its five theme palettes were transplanted.
- Do not modify sync, authentication, or stored-data behavior during visual/layout work.
- Do not change Supabase without Renee’s explicit approval and the baton.
- Do not modify `main` or the frozen `welcome-artwork-preview` branch unless Renee explicitly requests it.
- Do not alter the connected custom domains or Supabase Auth URL configuration without Renee's explicit approval for each step.
- Do not begin screenshot sync until the custom domain is live; do not ship the horse-advisor and coat-picker feature until screenshot sync is complete and reviewed.
- Do not run live attack tests against Renee’s real stable.
- Do not allow sample horses to persist locally, sync to a cloud stable, or appear in an upload prompt.
