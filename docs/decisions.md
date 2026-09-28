# Architecture and product decisions

Why Jinx’s Stables is built the way it is. Each entry says what we decided, why, and what it costs. Read this before changing something that looks odd; several of these were chosen on purpose over the "obvious" alternative.

To change a decision, add a new entry that supersedes the old one (with the date and who approved it) instead of editing history.

---

## D1. Fixed screenshot file names bound storage

**Decision (Sept 27, Renee).** Each horse has at most two files in the `horse-screenshots` bucket: `{user id}/{horse id}/thumb.jpg` and `full.jpg`. Uploads overwrite these names.

**Why.** The storage policy only accepts those two names, and only for a live horse in the uploader's own stable. With the 2,000-horse limit that is a hard server-side bound of 4,000 files per account, enforced by the database rather than by app code.

**Rejected alternative.** Versioned file names (revision 3, drafted and withdrawn). They fix the race in D2, but every upload adds a new file, so a modified client could keep uploading without limit and only client-side cleanup would stand in the way.

**Costs.** The file-count bound is not a cost bound by itself: 4,000 files at the 600 KB limit is about 2.4 GB, more than the free plan. Real cost control is the 600 KB per-file limit, compression, orphan cleanup, and watching storage usage. Fixed names also needed the cache fix `061b812` (downloads carry the picture's version as `cacheNonce`) so browsers do not show an old picture.

Records: STATUS history (Sept 27), `docs/screenshot-sync-plan.md`, `supabase/review/20260927_screenshot_storage.sql` (revision 2).

## D2. The two-device picture race is accepted

**Decision (Sept 27, Renee).** If two devices upload *different* pictures of the *same* horse at the same moment, the thumbnail and full picture can come from different uploads.

**Why.** It needs two devices changing one horse's picture within seconds of each other, which is very rare, and the fix (add the picture again) is easy. Preventing it would need versioned files, which D1 rejects.

## D3. One source of truth for horse records

**Decision.** There is exactly one horse collection per stable: the `public.horses` rows (cloud) and the app's single in-memory `horses` array and local copy that sync with them. Views, filters, sorting, and experiments read from it; nothing keeps a second copy.

**Why.** Horse records are the most important thing the app protects. A second collection can drift, double-save, or overwrite the real one.

**Rules that follow.** No alternate horse arrays for persistence, no extra Supabase table or query for a view, no extra localStorage or IndexedDB collection, no second sync queue, no second editor. Data migrations happen only with Renee's explicit approval.

## D4. Design Lab never owns data

**Decision (Sept 28).** The Design Lab is a presentation experiment. It renders the same `visibleHorses` list the current roster uses, from the same horse objects, and opens the existing editor with `openEditor(horse.id)`. It does not save, sort in place, sync, or migrate anything. Switching views causes zero writes.

**Why.** It lets us try a new desktop look safely, with the current roster as the control. Verified on `946cca2`: capsule, search and sort parity; byte-identical saved data after repeated toggles; editor changes appear in both views.

Records: `docs/design-lab-plan.md` on the Design Lab branches.

## D5. Mobile is protected from desktop experiments

**Decision.** Desktop experiments do not reach phones. At 640 px and below the Design Lab toggle and view do not exist and the standard phone cards are always used.

**Why.** Phones are where most real use happens, and the phone layout and Quick Add were already fixed and tested on a real iPhone (`0781eca`). An experiment must not risk them.

## D6. Screenshots are optional

**Decision.** A horse never needs a picture. Every screen must look intentional without one, and no feature may require a screenshot to work.

**Why.** Many players will never upload pictures, and pictures can be missing on a device that has not downloaded them yet.

## D7. Discord-only sign-in (for now)

**Decision (Sept 26, Renee).** Sign-in is Discord only. Commit `1877040` switched the preview to "Discord only during preview testing"; on Sept 26 Google sign-in was disabled with Renee's approval and the stray Google test account was removed (`e564461`).

**Why (as recorded).** One provider during testing, and the beta is run through Discord guild communities. Google and Facebook are postponed. If another provider is added later, it must connect to the same stable rather than create a second one (see D3).

## D8. Suggestions never auto-fill

**Decision.** Anything the app infers (coat picker, horse advisor, text read from screenshots, photo identification) is shown as a suggestion. The player confirms before anything is saved. The app never silently overwrites a field.

**Why.** The coat catalog descriptions are still partly unconfirmed, many coats differ only in details a color sample cannot see, and AI summaries have been wrong about coat codes. A wrong value saved silently is worse than an empty one.

Related rules: coats are marked "Confirmed" only from a picture source or a player who knows the horse; AI search summaries are not a source. Dream (T9) and Mythical (T10) horses skip the coat step and ask for the Dream type instead (player-confirmed: T9 Doom has red flames, T10 Mythical Doom has blue flames).

Records: `docs/screenshot-sync-plan.md` sections 10 and 11.

## D9. No confidence percentages until measured

**Decision.** Photo identification and similar features show no confidence percentages until accuracy has been measured against labeled examples.

**Why.** A made-up percentage looks precise and misleads players. Ranked "likely matches to confirm" are honest until there is data.

Records: `docs/screenshot-sync-plan.md` (photo identification requirements).
