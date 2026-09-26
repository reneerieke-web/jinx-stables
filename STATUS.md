# Jinx’s Stables — Project Status

Updated: September 26, 2026 (ET)

## Baton

- **Current builder:** Codex
- **Backup builder:** Claude, working only on `claude/<task>` when the baton is explicitly handed over
- **Active branch:** `cloud-sync-preview`
- **Last code commit:** `791d689` — Desert Sunset recolor, built on `15405c3`
- **Review status:** Codex reviewed `791d689`: CSS and `STATUS.md` only, with no JavaScript, sync, authentication, or data changes
- **Pending on `claude/focused-bardeen-ikb2lu`:** two Claude security commits on top of `e564461`, waiting for Codex review and merge: the tier XSS fix, then the SheetJS 0.20.3 upgrade with import limits. Renee approved both builds; Claude did not write to `cloud-sync-preview`.

Only the baton holder writes to `cloud-sync-preview`. When handing off, update this file in the same commit with the new baton holder, last commit, completed work, next task, and anything that must not be touched.

## Team workflow

- Renee decides scope, approves consequential changes, and performs acceptance testing.
- The baton holder builds and commits.
- Whoever did not write a change reviews it before Renee tests it.
- Claude may inspect Supabase, but only the baton holder may change Supabase, and only with Renee’s explicit approval.
- This repository is public. Never put secrets, credentials, private account information, or personal information in this file or anywhere else in the repository.

## Done

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
- Security checkpoint status: Mini declined the targeted audit and is no longer responsible for it. Codex completed a read-only code/configuration review of `e564461` (recorded in Codex commit `7540b39`, not yet pushed when this was written): ownership/RLS policies are structured correctly, anonymous users have no table access, signed-in users have no hard-delete grant, and no service-role key is in the page. Claude independently confirmed those same four points.
- The stray Google-provider test account and its empty stable were deleted after Renee confirmed the exact target. The Discord account and its 77-horse stable were verified intact, and Google Auth was disabled with Renee's approval.

## Next

1. Pre-production security blockers (all required before `main`):
   - **Tier XSS (found by Claude, fix pending review):** a crafted JSON backup or transfer file could run script because the card tier badge was not escaped and restore/transfer accepted any tier value. Fix: `esc()` on the tier badge in `cardBody`, and `mk()` only accepts tiers listed in `TIER_LABEL` (anything else becomes `8`). Tested on `e564461` in a signed-out local copy: the payload fired before the fix and fires zero times after it, on desktop and phone, including a bad tier already saved on the device. A real full-stable backup restores with every tier unchanged.
   - **SheetJS 0.18.5 (found by Codex, fix by Claude pending review and one verification):** the embedded reader is now the SheetJS 0.20.3 core build (the same build type as before), fixing CVE-2023-30533 and CVE-2024-22363. Spreadsheet import now refuses files over 5 MB and sheets over 2,000 rows, parses at most 2,001 rows, and skips formulas and HTML. Tested: a real 77-row roster still maps normally, a 2,500-row sheet (xlsx and csv) and a 6 MB file are refused with a clear message, and the roster .xlsx export is cell-for-cell identical to the 0.18.5 export. **Verification still required before merge:** the cloud session could not reach cdn.sheetjs.com, so the file came from the npm mirror `@e965/xlsx@0.20.3` (published with SLSA provenance). Its SHA-256 is `197255b0c278588117e45c14c1b25398562864cd9ffa9752c4b4d29f6d9bfd27`. Someone must download the official `https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.core.min.js` and confirm the same hash.
   - **Cross-account isolation test: PASSED.** With Renee’s OK, Claude created two fake users with fake stables inside one transaction that was forced to roll back, and ran 26 attacks as the attacker using a real authenticated JWT identity: reading, editing, soft-deleting, hard-deleting, planting, moving, and upserting horses in the other stable; renaming, stealing, reassigning, cloning, and deleting stables; truncate; reading `auth.users`; and anonymous read/write. Every attack returned 0 rows or was refused. Two control checks confirmed the attacker could still use their own stable. The before and after fingerprints of Renee’s data are identical, and no test users remain.
   - Non-blocking: Supabase leaked-password protection is off, which does not matter while sign-in is Discord only.
2. Merge `cloud-sync-preview` into `main` — Renee’s approval required.
3. Connect `jinxsstables.com` (double **s**) only after the security checkpoint and production merge.

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
- Do not merge to `main` or connect `jinxsstables.com` until every security blocker above is fixed and reviewed, the isolation test passes, and Renee gives approval.
- Do not run live attack tests against Renee’s real stable.
- Do not allow sample horses to persist locally, sync to a cloud stable, or appear in an upload prompt.
