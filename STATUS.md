# Jinx’s Stables — Project Status

Updated: September 26, 2026 (ET)

## Baton

- **Current builder:** Codex (out until about 1:42 PM ET on September 26; Renee handed Claude the Desert Sunset recolor only)
- **Backup builder:** Claude, working only on `claude/<task>` when the baton is explicitly handed over
- **Active branch:** `cloud-sync-preview`
- **Last code change on `cloud-sync-preview`:** `15405c3` — theme-aware desktop header, phone panels, and phone editor Save bar on top of `c31c786`
- **Pending on `claude/focused-bardeen-ikb2lu`:** Desert Sunset recolor by Claude, built on `15405c3`, waiting for Codex review and merge
- **Review status:** Claude reviewed `c31c786` as safe. Claude authored the `15405c3` follow-up, so Codex’s line-by-line check before committing it is the independent review. The Desert Sunset recolor still needs Codex’s review.

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
- Desert Sunset now reads as a sunset: violet sky fading through plum and rose to an orange horizon glow, with plum panels and a sunset-orange accent. Desert only, CSS only (Claude, on `claude/focused-bardeen-ikb2lu`, pending review).

## Next

1. Codex reviews the Desert Sunset commit on `claude/focused-bardeen-ikb2lu`, merges it into `cloud-sync-preview`, and takes the baton back.
2. Renee tests the `cloud-sync-preview` deployment: every desktop theme, and the Dark, Amber, and Blue phone themes.
3. Decide whether to make Claude’s optional header-review refinements:
   - make Appearance the same size as the other desktop menu items;
   - clarify that the first count is for the current tab;
   - make keyboard Tab order match the visual menu order without CSS `order`.
4. Renee decides whether to hide the Red/White/Black breeding-point boxes from the normal editor and rename the “Coat & Breeding Color Data” section, keeping the values in the coat catalog for a possible breeding planner later.
5. Continue coat-description review and data validation as Renee confirms coats.

## Do not touch

- Do not reset `cloud-sync-preview` to `909cf41` or discard later commits.
- Do not apply Claude’s old `header-and-themes.diff`; `398e677` replaces its header work.
- Do not replace the current file with Claude’s attached full `index.html`; only its five theme palettes were transplanted.
- Do not modify sync, authentication, or stored-data behavior during visual/layout work.
- Do not change Supabase without Renee’s explicit approval and the baton.
- Do not modify `main` or the frozen `welcome-artwork-preview` branch unless Renee explicitly requests it.
- Do not allow sample horses to persist locally, sync to a cloud stable, or appear in an upload prompt.
