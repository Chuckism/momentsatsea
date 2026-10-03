# Moments At Sea: project notes

Notes carried between Claude Code sessions. Last updated 2026-10-03.
These record decisions and status that the code and git history don't show.
Before acting on anything here, check it against the current repo.

## Working rules

- **Never commit straight to `main`.** `main` deploys directly to the live static site, so all work goes on branches until Chuck has tested it on real phones.
- **Start new work from the newest branch** (currently `feat/magazine-pdf`), not from `main`, unless the branches have been merged.
- Chuck hasn't asked for pull requests or merges yet. Don't open them without being asked.

## Branch status

There are three unmerged branches, all pushed to GitHub. Each one builds on the one before it, so merge them in this order:

1. `fix/journal-data-loss`
2. `feat/keepsakes-foundation`: display copies, photo selection, a save/share helper, favorites and sharing in keepsakes, a rebuilt video, and end-to-end tests
3. `feat/magazine-pdf`: saves the magazine as a PDF instead of opening the print dialog, and lets busy days continue onto photo pages

Changes in the working tree that weren't committed as of 2026-10-03: `capacitor.config.ts` and `public/sw.js` (modified), and `android/`, `docs/` and `repomix-output.xml` (untracked). Review these before committing.

## Waiting on Chuck

These can't be done from the Windows machine:

- [ ] Test on a real iPhone and a real Android phone. So far, everything has only been tested in Chrome on Windows.
- [ ] Do the iOS Capacitor 8 migration on a Mac.
- [ ] Run `npx cap sync` for the new Share and Filesystem plugins.
- [ ] Decide what momentsatsea.com should show. In October 2026 it served an unconfigured WordPress page, and keepsakes link to it through `lib/brand.js`.
- [ ] Account checks: Apple Developer renewal, Play Console, and the Supabase plan.

## Product decisions (October 2026)

Chuck made these when restarting the project after about 10 months away. Don't reopen them unless Chuck does.

### Niche: cruises only

- Launch for cruises only, even though friends suggested "any vacation".
- Later, expand only to similar offline trips that follow an itinerary: first river and expedition cruises, then guided tours or rail trips. Only do this once there are paying users.
- Why: a general travel journal competes with free products from large companies. Cruises have a real need to work offline, passengers already pay for keepsakes of the trip, and travel agents offer a way to reach customers.
- Keep features and wording specific to cruises.

### Distribution

- Ship App Store and Play Store apps (built with Capacitor) alongside the PWA, all from the same code.
- Checkout happens on the web. The apps link out to it.

### Cloud backup and the Voyage Pass

- Everything backs up to Supabase. This also removes the risk of iOS clearing the PWA's storage.
- Free backups are kept for **6 months after the cruise ends**. A **Voyage Pass** keeps them forever.
- Everyone gets their 2048px display copies backed up. Originals are backed up for pass holders, or when the user is on home Wi-Fi.
- Fairness rules:
  - Email a warning 30 days and 7 days before deleting a backup.
  - Always let users download their own photos and journal for free.

### Approved customer wording

Chuck loved this wording, so use it as is on the backup screen, the pass checkout and the deletion warnings:

> Free cloud backup for 6 months after your cruise. Keep it, and your shared story, forever with a Voyage Pass.

### Sharing roadmap

1. A private share link for each cruise
2. Family or cabin co-authoring
3. Later, public pages for each sailing, opt-in only and moderated
