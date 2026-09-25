# Jinx's Stables

Jinx's Stables is a browser-based horse roster, breeding, training, Courser, Dream, and Mythical tracker for Black Desert Online.

## Current release

This repository contains the clean public website build of Version 19.

## Features

- Full horse roster: tier (T1-T10, including Dream and Mythical), coat, gender, skills, breeding parents, training/sale/delivery status
- Dream (T9) and Mythical (T10) subtype system, with specialized skill tracking per subtype and a "needs review" flag for skill data that hasn't been verified yet
- Quick Add for fast entry without opening the full editor
- Spreadsheet import and export: download a template, fill it in bulk, import it back with field mapping and validation, or export the full roster to XLSX
- Transfer Roster to Another Device: move a roster between devices by hand through an export/preview/merge workflow
- Automatic local safety snapshots before any destructive action (import or transfer), restorable with one click

## Privacy and storage

- Horse records are stored locally in the visitor's browser.
- The application does not include or publish Renee's personal roster.
- Screenshots are stored locally in IndexedDB and are device-local.
- Cross-device roster movement is manual through the app's transfer-file workflow.
- Users should keep regular JSON backups.

## Why manual transfer instead of live sync

Roster movement between devices is intentionally manual rather than automatic. Live sync was scoped out in detail and set aside because it would have required either a Claude-account-gated backend (defeating the point of a public tool anyone can use) or a second, separately maintained build (too much risk of version drift and horses entered into the wrong copy). The manual transfer workflow, export, preview, merge or replace, needs no backend and no accounts, and works today.

Every horse record carries an `ownerId` field, preserved through every import, migration, and transfer path, even though nothing in the app currently reads it. That's deliberate groundwork for a future proper multi-user backend, so that feature won't require another data migration on top of everyone's existing rosters.

## Deployment

The production site is deployed from this repository through Cloudflare Pages. The site is a static application; no build command is required.

## Repo conventions

- The production build should not be edited casually. If you need a scratch or QA copy to test something like a library swap, make a clearly labeled separate file and say so in the PR rather than touching the real one.
- Treat any real horse names or data referenced in the codebase or issues as real user data, not test fixtures. Don't auto-rewrite or "clean up" specific horses without asking.

## Credits

Created by Renee Rieke.

Black Desert Online is a trademark of Pearl Abyss. This independent fan-made tool is not affiliated with or endorsed by Pearl Abyss.
