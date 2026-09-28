# Design Lab: desktop roster-view experiment

Status: foundation only; no alternate UI has been implemented.

Base: `cloud-sync-preview` at `0781eca6ea8a797c36e378b77a817d000f121630`.

## Purpose

Design Lab is a temporary, desktop-only presentation experiment for the horse roster. It will let us explore a more photography-forward, editorial stable-catalog treatment while the current roster remains available as the control.

This foundation does **not** redesign the roster, expose a Design Lab control, or change application behavior.

## Non-negotiable data boundary

There is exactly one source of truth for horse records: the existing `horses` collection and its existing local/cloud persistence path.

Design Lab must:

- receive the same filtered and sorted horse object references used by the current roster;
- never seed, copy, clone for persistence, migrate, transform, or maintain an alternate horse collection;
- never introduce a second storage key, table, query, schema, import path, sync queue, or record format;
- never change horse IDs; and
- never write horse data directly.

If an account has 40 horses, both presentations must report and display those same 40 horses, subject to the same current capsule and filters.

## Smallest safe architecture

The current application already has a useful boundary:

1. `horses` is the canonical in-memory collection.
2. Existing capsule/filter/search logic selects matching records.
3. Existing sorting produces the visible list.
4. `renderGrid()` currently creates the control presentation.
5. Card activation calls the authoritative `openEditor(h.id)` editor.

When Renee approves UI implementation, preserve steps 1–3 and split only step 4 behind a presentation selector:

```text
canonical horses
      |
existing capsule + filter + search + sort
      |
same visible horse object references
      +-- Current roster renderer (control)
      +-- Design Lab renderer (experiment, desktop only)
                    |
                    +-- openEditor(h.id)
```

Recommended future functions:

- `selectVisibleHorses()` — extracts the existing `sortHorses(horses.filter(matches))` selection without changing its behavior.
- `renderCurrentRoster(visible)` — the present card-building loop, moved without visual or behavioral changes.
- `renderDesignLabRoster(visible)` — presentation-only markup for the approved experiment.
- `renderRosterView()` — chooses the renderer, but must force the current renderer at mobile widths.

Because Jinx's Stables is currently a single-file application with many shared display helpers, the first implementation should use a clearly delimited Design Lab block in `public/index.html` rather than exporting horse state or business logic into a parallel application. Design Lab-specific CSS should use a `.design-lab` namespace. If the experiment grows, presentation-only code may later move to an isolated static file, but the canonical collection and editor must remain in the existing application.

## Entry and control

Design Lab should be entered through a desktop-only **presentation toggle**, tentatively labeled `View: Current roster | Design Lab`, near the roster controls or in the desktop menu.

It should not be added to `CAPSULES`: capsules describe horse lifecycle/status groups, while Design Lab describes presentation. Keeping those concepts separate preserves existing counts, filters, URLs, and capsule behavior.

The initial control should:

- default to `Current roster`;
- preserve the active capsule, search, filters, and sort when switching views;
- be unavailable at the existing mobile breakpoint (`max-width: 640px`); and
- automatically fall back to the current renderer if the viewport becomes mobile-sized.

No Design Lab preference should be synced to Supabase. A session-only preference is safest for the first experiment; persistent presentation preference requires a separate approval.

## Authoritative editing behavior

The experiment is read-only as a renderer. Activating a horse must call the existing `openEditor(h.id)` function. Design Lab must not implement a second editor, inline editing, alternate save behavior, or new mutation controls.

All creation, editing, saving, deletion, restoration, screenshot, and sync behavior remains owned by the existing application paths.

## Tester and data-safety rules

- The current roster remains present and usable as the control.
- Design Lab is additive and must be opt-in on desktop.
- Real tester horses must never be rewritten or normalized for the experiment.
- No changes to persistence, cloud sync, Supabase, SQL, Storage, authentication, screenshots, feedback, Recently Deleted, import/export, horse IDs, or schemas.
- No second horse collection, sample copy, shadow cache, or Design Lab migration.
- Do not use production as the Design Lab development branch.
- Do not merge or deploy Design Lab without Renee's explicit approval and normal review/testing.

## Mobile boundary

The current breakpoint is 640 px. The future entry control and experimental container must be desktop-only above that breakpoint. At 640 px and below:

- no Design Lab entry is rendered or exposed to keyboard/accessibility navigation;
- the current mobile roster remains the only renderer;
- the mobile Quick Add, editor, menu, filters, and cards remain unchanged; and
- resizing from desktop Design Lab into mobile immediately restores the current renderer.

Desktop acceptance testing should include at least 1024 px and 1440 px. Regression checks must include 320, 375, 390, and 430 px to prove Design Lab is absent and the existing phone experience is unchanged.

## Promotion without migration

If the experiment is approved as the normal desktop presentation, promotion consists only of changing the renderer selected by default (and optionally removing the old renderer after a separate approval). The canonical `horses` collection, record schema, IDs, editor, persistence, import/export, and cloud-sync paths do not change. Users do not migrate, re-import, recreate, or resave horses.

## Removal and rollback

Design Lab can be removed by deleting its namespaced presentation code/styles and its desktop view toggle, then routing desktop rendering exclusively to the current renderer. Because it never owns or persists horse data, removal cannot delete, alter, or strand horse records.

## Required checks before the first UI review

- Current roster output and behavior are unchanged when `Current roster` is selected.
- Both renderers receive the same object identities and visible horse IDs in the same order.
- Both views show the same total/capsule/filter counts.
- Design Lab horse activation opens the existing editor for the same ID.
- No Design Lab code calls persistence, sync, Supabase, Storage, import/export, delete, or restore functions.
- Design Lab cannot appear at 320, 375, 390, 430, or any width at or below 640 px.
- Switching views and removing the experiment do not modify stored horse data.

## Not part of this foundation task

- No alternate roster markup or styling.
- No photography, typography, divider, whitespace, card, or field-journal redesign.
- No visible Design Lab entry or toggle.
- No changes to `public/index.html`.
- No deployment or merge.
