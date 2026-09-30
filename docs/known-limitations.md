# Known limitations

Things that work differently from what a player might expect, or that are not handled yet. None of these loses horse data. When one is fixed, move it to the STATUS history with the fixing commit. Numbers are not reused. L4 (the phone editor's sticky Delete/Save bar showing content through it) was fixed and released in `0f9dc7a` on Sept 29.

| # | Limitation | Effect | Status |
| --- | --- | --- | --- |
| L1 | An open, focused device does not pull changes from other devices until you switch back to it or reload. | Edits made on the phone appear on an already-open computer only after focus or reload. | Existing sync behavior (pull on focus/visibility). A periodic pull while visible would fix it; protected sync code, post-beta decision. |
| L2 | Phone cards do not show the camera badge. | You cannot see which horses have pictures from the phone roster (desktop shows it). | Backlog, polish pass. |
| L3 | iOS offers "AutoFill Contact" on the horse Name field and the delete-confirmation name box. | Clutter, and a risk of filling in a contact name. | Backlog, after the beta. |
| L5 | Two devices uploading different pictures of the same horse at the same moment can pair a thumbnail from one with the full picture from the other. | Very rare; adding the picture again fixes it. | Accepted on purpose (`docs/decisions.md`, D2). |
| L6 | Stables over 1,000 horses only show 1,000 on a device: `fetchCloudRoster()` and `pullCloudWhenSafe()` read horses in one request, and the API returns at most 1,000 rows. | Nothing is deleted from the cloud, but the extra horses do not appear on that device. No stable is near this size. | Needs paging (like the screenshot cleanup) in a separately reviewed sync change before any stable approaches 1,000. |
| L7 | While one oversized horse is blocked from saving (over the 32 KB record limit), that device pauses pulling changes from other devices. | The device is safe but stale until the blocked horse is fixed; the banner names the horse. | Backlog: let unrelated remote updates through. |
| L8 | No CI: tests run only when Claude or Codex runs them by hand. | A regression could reach a branch unnoticed if nobody runs the suites. | Backlog, optional improvement. |
| L9 | Pictures that have not been downloaded to a device yet do not appear in the desktop Design Lab (it reads the local cache only). | Some rows show no thumbnail on a device that has not opened that horse. | Intentional for the experiment (`docs/design-lab-plan.md`); fixing it touches sync and needs its own review. Not deployed. |
| L10 | The phone editor's content is a few pixels wider than the screen; the extra width is clipped (`overflow-x: clip`), so it cannot scroll sideways. | No visible effect found so far. | Pre-existing (seen on `0781eca` and `0f9dc7a`); not yet fixed. |
| L11 | `tests/mobile-quick-add.e2e.js` cannot run: it calls app-private functions such as `markSeeded()` that are not reachable from the page. | The Quick Add browser test gives no protection until repaired (the structural test `tests/mobile-quick-add.test.js` still runs). | Pre-existing (fails the same way on `0781eca`); not yet fixed. |
