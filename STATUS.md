# Jinx’s Stables — Project Status

Updated: September 26, 2026 (ET)

## Baton

- **Current builder:** Codex
- **Backup builder:** Claude, working only on `claude/<task>` when the baton is explicitly handed over
- **Active branch:** `cloud-sync-preview`
- **Last code change:** current commit — per-theme panel and accent palettes applied on top of `398e677`
- **Review status:** `398e677` passed Claude’s review; the current theme-only change is ready for Claude’s review

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
- Moonlit, Autumn, Snowy, Desert, and Black Spirit now use matching panel, border, accent, and muted-text palettes; Classic and Forest retain the original green (current commit).

## Next

1. Claude reviews the current theme-only commit at 1366px, 1024px, and 390px before Renee tests it.
2. Renee tests the reviewed `cloud-sync-preview` deployment.
3. Decide whether to make Claude’s optional header-review refinements:
   - make Appearance the same size as the other desktop menu items;
   - clarify that the first count is for the current tab;
   - use `var(--panel)` for the desktop header background;
   - make keyboard Tab order match the visual menu order without CSS `order`.
4. Continue coat-description review and data validation as Renee confirms coats.

## Do not touch

- Do not reset `cloud-sync-preview` to `909cf41` or discard later commits.
- Do not apply Claude’s old `header-and-themes.diff`; `398e677` replaces its header work.
- Do not replace the current file with Claude’s attached full `index.html`; only its five theme palettes were transplanted.
- Do not modify sync, authentication, or stored-data behavior during visual/layout work.
- Do not change Supabase without Renee’s explicit approval and the baton.
- Do not modify `main` or the frozen `welcome-artwork-preview` branch unless Renee explicitly requests it.
- Do not allow sample horses to persist locally, sync to a cloud stable, or appear in an upload prompt.
