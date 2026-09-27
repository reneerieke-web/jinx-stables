# Jinx’s Stables — Project Status

Updated: September 26, 2026 (ET)

## Baton

- **Current builder:** Codex
- **Backup builder:** Claude, working only on `claude/<task>` when the baton is explicitly handed over
- **Active branch:** `cloud-sync-preview`
- **Last code commit:** `6543f03` — SheetJS 0.20.3 core upgrade and spreadsheet import limits, following tier XSS fix `77a17b0`
- **Production head:** `main` is fast-forwarded to the approved launch release and its completed domain-launch documentation checkpoint
- **Review status:** Codex reviewed both Claude security commits, confirmed the embedded SheetJS file is byte-for-byte identical to the official 0.20.3 core build, and merged them with the production-origin allowlist update; Renee approved the resulting preview on phone and desktop

Only the baton holder writes to `cloud-sync-preview`. When handing off, update this file in the same commit with the new baton holder, last commit, completed work, next task, and anything that must not be touched.

## Team workflow

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
- The stray Google-provider test account and its empty stable were deleted after Renee confirmed the exact target. The Discord account and its 77-horse stable were verified intact, and Google Auth was disabled with Renee's approval.

## Security checkpoint

- **Tier XSS: FIXED AND REVIEWED.** A crafted JSON backup or transfer file could previously place an unescaped value in the card tier badge. `mk()` now accepts only tiers listed in `TIER_LABEL` (anything else becomes Tier 8), and `cardBody()` escapes the badge value.
- **Spreadsheet reader: FIXED AND REVIEWED.** SheetJS 0.18.5 was replaced by the verified official-equivalent 0.20.3 core build. Imports over 5 MB or 2,000 rows are refused with a clear message; parsing stops at the limit and skips formulas and HTML. Claude tested the real 77-row roster, oversized XLSX/CSV files, and export equivalence.
- **Cross-account isolation: PASSED.** With Renee’s approval, Claude ran 26 attacks as a simulated second authenticated user inside a forced-rollback transaction. Cross-account horse and stable reads/writes, ownership changes, deletes, truncate, `auth.users` access, and anonymous access were all blocked. Control checks showed the simulated user could still use its own stable. Renee’s before/after fingerprints matched, and no test users remained.
- **Non-blocking:** Supabase leaked-password protection is off, which is not applicable while sign-in is Discord-only.

## Next

1. Add approved data-size safeguards: 32 KB per horse, 2,000 horses per stable, and 100 characters per stable name, with a friendly app error when a save is rejected. Claude reviews the SQL before anything is run against Supabase.
2. Add the privacy note to the site footer.
3. Prevent iOS from offering “AutoFill Contact” on the horse Name field.
4. Plan and then build screenshot sync: private per-user Supabase Storage, compressed uploads, storage RLS, and an isolation test before release.
5. Ship the horse advisor, Keep this coat, and screenshot color picker from Claude’s `horse-advisor-and-coat-picker.diff` after screenshot sync.

## Backlog

- Coat pairing planner using R/W/B catalog values, once enough horses have real coat codes (community color theory, label as unofficial).
- Optional White color group.

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
