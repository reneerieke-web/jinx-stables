# Supabase change log

Every change made to the production Supabase project, newest last. Unlike code, these cannot be undone with Git, so record each one here in the same commit that reports it: the file or setting, when it was applied, who ran it, who approved it, and how it was verified.

Rules: only the baton holder changes Supabase, only with Renee's explicit approval. Read-only (SELECT) lookups for verification are fine.

Where the repository does not record a date or approval, this log says so instead of guessing.

## Applied SQL

| Change | File | Applied | Run by / approval | Verified |
| --- | --- | --- | --- | --- |
| Data limits: 32 KB per horse record, 100-character stable names, at most 2,000 horses per stable (trigger `enforce_horses_per_stable_limit`) | `supabase/review/20260927_data_size_limits.sql` | Sept 27, 2026. Exact run time not recorded; the application was logged at 2:18 AM ET (`4613020`). | Run by Renee in the Supabase SQL Editor with her approval, after Claude approved the SQL (replica tests). Supabase reported `Success. No rows returned`. | Read-only by Claude, logged 2:29 AM ET (`876e8a9`): both CHECK constraints validated, trigger enabled, EXECUTE limited to `postgres`/`service_role`, all 77 rows pass. Live end-to-end test logged 2:30 AM ET (`c139b60`). The app-side handling (`61a2b41`) was deployed first. |
| Screenshot storage: private `horse-screenshots` bucket (600 KB, image/jpeg) and four owner policies, revision 2 | `supabase/review/20260927_screenshot_storage.sql` | Sept 27, 2026, 10:35 AM ET (logged in `acab0e6`) | Run by Claude with Renee's explicit approval, in one transaction, from the reviewed file at `2cf585a`. Codex approved revision 2 (`264d7bf`, `3a4d00e`). | Read-only (`acab0e6`): bucket private, 600 KB, image/jpeg only; exactly four owner policies; helper is SECURITY INVOKER with empty search_path; all horse rows intact. Live cross-account test passed (`89acc51`). |
| Text feedback: `public.feedback` (insert-only, column-level INSERT, 20 per day limit) | `supabase/review/20260927_feedback.sql` | **Applied, but the date, who ran it, and the approval are not recorded in this repository.** Commit `0e268ac` (Sept 27) still describes this file as review-only. | Not recorded. | Its presence was confirmed by read-only checks. Sept 27 (Claude, during the feedback-screenshot work): the table's columns, the column-level INSERT grant for signed-in users, and the single insert policy matched this file. Sept 28 (recorded on `claude/design-lab-v2`, `ce4b651`): column-level INSERT only for signed-in users, rate-limit function EXECUTE limited to `postgres`/`service_role`. |

## Not applied

| Change | File | State |
| --- | --- | --- |
| Optional feedback screenshots: `has_screenshot`, generated `screenshot_path`, private `feedback-screenshots` bucket, upload-only policies, locked daily limits | `supabase/review/20260927_feedback_screenshots.sql` on `claude/focused-bardeen-ikb2lu` (`71326c5`) | **Not applied.** Read-only check on Sept 28 found no `private` or `feedback_private` schema and no `feedback-screenshots` bucket. Open review items are listed in STATUS.md. |

## Other Supabase configuration changes (not SQL files)

| Change | When recorded | Approval |
| --- | --- | --- |
| Deleted the stray Google-provider test user and its empty stable; disabled Google sign-in (Discord remains enabled) | Sept 26 (`e564461`) | Renee confirmed the exact target and approved disabling Google. |
| Auth Site URL set to `https://jinxsstables.com`; redirect URLs added for `https://jinxsstables.com` and `https://www.jinxsstables.com`, keeping the workers.dev URLs | Logged Sept 27, 1:37 AM ET (`564d1fc`); exact change time not recorded | Renee's separate approval for this step (as recorded). |
