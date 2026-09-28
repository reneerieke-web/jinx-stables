# Test results

A permanent record of the important manual, real-device, and security tests. Automated tests live in `tests/` and are run by hand (there is no CI yet; see `docs/known-limitations.md`).

Each entry lists where it was first recorded. Entries marked "reported by Renee (Sept 28 handoff)" come from Renee's written summary and were not previously recorded in this repository.

---

## Real-device screenshot sync (Sept 27)

Tester: Renee. Devices: iPhone Safari and Windows Chrome, on the preview site. Recorded in `1d5fe2a`.

| Test | Result |
| --- | --- |
| Two-way sync, computer to phone and phone to computer (6 horses) | Pass |
| Replace a picture, both directions | Pass |
| Remove and re-add, both directions | Pass |
| Delete a horse, then Recently deleted, then Restore: the picture comes back on both devices (CaramelMeringue) | Pass |
| Remove a picture while offline, then reconnect: the removal syncs | Pass |
| Upload an iPhone camera photo while offline, then reconnect: it uploads (cloud files and pointer confirmed read-only) | Pass |
| iPhone camera photos (the HEIC question) display on Windows Chrome | Pass |
| Log out and back in: the full stable returns (48 active / 77 total) | Pass |

### Stale-picture cache bug (found and fixed Sept 27)

- **Found:** after a Replace, normal Chrome kept showing the old picture even after a full reload, while an Incognito window showed the new one (recorded in `1d5fe2a`). The horse was PralineKnot; the old picture was the "Hydrate" image and the new one the "Crystal Light" image (names reported by Renee, Sept 28 handoff).
- **Cause:** fixed file names (see `docs/decisions.md`, D1) meant the same download address, and a cached response was saved under the new version.
- **Fix:** `061b812` (Codex approved; no SQL or Supabase change). Downloads pass the picture's version as `cacheNonce`, and older cached copies are re-fetched once (`cacheScheme: 2`).
- **Retests:** the stuck copy corrected itself, and a fresh phone Replace of PralineKnot showed on normal Chrome after reload (recorded in `1d5fe2a`). A later replacement from "Crystal Light" to "Hello Kitty" also synced correctly (reported by Renee, Sept 28 handoff).

## Mobile Quick Add (Sept 27)

- **Problem:** adding a horse (NillaCrumpet) on an iPhone: the form was too large for the screen, repeated Level + taps zoomed the page, and Save became hard or impossible to reach.
- **Fix:** `0781eca` (16 px phone form controls, no Name autofocus on phones, `touch-action: manipulation` on buttons, two-column phone skills, a wrapping always-reachable footer, dynamic modal height, overflow protection). An earlier attempt, `0b4e6d8`, was rejected because it was built on an old ancestor.
- **Structural tests** (`tests/mobile-quick-add.test.js`, `tests/mobile-quick-add.e2e.js`): 320, 375, 390 and 430 px phones, 1024 and 1440 px desktop, rapid Level + to 30, save ordering, columns, footer reach, autofocus, overflow. The rendered browser matrix could not run in Codex's environment at the time.
- **Real device:** Renee's iPhone add, save, cross-device, and delete test passed before `main` moved to `0781eca` (recorded in the STATUS notes on the Design Lab branches).

## Security and isolation tests

### Cross-account isolation, horse data (Sept 26)

Run by Claude with Renee's approval, as a simulated second signed-in user inside a forced-rollback transaction. 26 attacks: reading, editing, soft- and hard-deleting, planting, moving, and upserting horses in another stable; renaming, stealing, reassigning, cloning and deleting stables; truncate; reading `auth.users`; anonymous read and write. **All blocked.** Two control checks confirmed the simulated user could still use its own stable. Before and after fingerprints of the real data matched, and no test users remained. Recorded in `6543f03`.

### Tier XSS (Sept 26)

A crafted JSON backup with script in the `tier` field fired before the fix and zero times after it (`77a17b0`), on desktop and phone, including a bad tier already saved on the device. A real full-stable backup kept every valid tier.

### Spreadsheet reader (Sept 26)

SheetJS 0.20.3 (`6543f03`): a real 77-row roster still imports; a 2,500-row sheet (XLSX and CSV) and a 6 MB file are refused; the roster export is cell-for-cell identical to the 0.18.5 export. Codex later confirmed the embedded file is byte-for-byte identical to the official download (SHA-256 in the STATUS history).

### Screenshot storage policies (Sept 27)

- **Local replica:** 27/27 policy checks for storage SQL revision 2 (`tests/storage/run_policy_tests.sh`), including the 2,000-horse / 4,000-file boundary and overwrite at the limit. Revision 1 was shown to fail with "infinite recursion" on the first upload.
- **Live cross-account test, passed (about 10:45 AM ET):** run by Claude with Renee's approval as two simulated signed-in users inside forced-rollback transactions. 32 checks: own uploads, both replace paths, reads and deletes succeed; soft-deleted, unknown and other-user horse ids, other-user folders, `../`, extra folders, empty folder, other names and PNG are refused; one user cannot list, edit, overwrite, move into, or delete another user's files; signed-out visitors see nothing, cannot upload, and cannot run the path-check function. Two first-run failures were mistakes in the test queries and passed when corrected. Nothing was left behind. Recorded in `89acc51`.

### Data limits (Sept 27)

- **Replica tests** before applying: the 2,000-row boundary, existing-row upserts at the limit, 32 KB horse data, 100-character stable names, RLS isolation, and direct function-call denial.
- **Read-only verification after applying:** both CHECK constraints exist and are validated, the horse-limit trigger is enabled, function EXECUTE is limited to `postgres` and `service_role`, and all 77 existing horse rows pass (largest stored record 2,470 bytes). Recorded in `876e8a9`.
- **Live end-to-end test:** a normal horse (ButterBean) saved; an oversized test horse never reached the cloud; after its notes were shortened the warning cleared; the test horse was deleted into Recently deleted for the normal 30-day purge. Recorded in `c139b60`.

### Feedback (Sept 27)

- Text feedback SQL: 21/21 local replica checks (`tests/storage/run_feedback_tests.sh`): insert-only, content columns only, no read-back, spoofing and pre-triage blocked, length and category limits, anonymous access blocked, 20 per day.
- Feedback screenshots (not deployed): results for revision 2 are recorded on `claude/focused-bardeen-ikb2lu` and will be summarized here once that work is approved.
