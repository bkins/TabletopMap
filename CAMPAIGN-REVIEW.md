# Campaign management review

Released candidate: **0.4.0 / campaign-management-2026-10-19-v1**. The earlier 0.3.0 release is retained as history.

## Demo the current version

Run `Start-TabletopMap.cmd` and open **http://localhost:5180/**. Version 0.4.0 is the current demo/release, authorized by Ben on October 19. The former port-5190 review server is retired on the development computer. Pre-upgrade backups and the old review copy are retained for recovery, not as separate demo versions. The DM will decide product acceptance using the checklist below.

## Automation can test

- Legacy save migration, retained original snapshot and schema-2 rejection of missing/invalid workspace data.
- Separate selected/published maps, private import/edit/selection, deliberate Show to Players and persisted selection across restart.
- Campaign isolation and Wi-Fi disable/blank on campaign change; continuing sessions and resource defaults separate from location progress.
- Named NPC movement with one identity/placement; independent template IDs, credentials and positions; private-map phone movement still targets the published map.
- Groups reference reusable resources; floor navigation privately selects a map; no physical connections are created.
- Full all-campaign backup/restore/restart and existing fog/calibration/blanking/token/phone/dice/profile behavior.

Results and exact source hashes are recorded in `review-2026-10-19-campaigns/Review.md` and `SHA256SUMS.txt`.

## Human needs to test

Export a backup before trying changes you do not want to retain. Apply/Save desired form edits before a page reload.

- [ ] Review the labels and controls at your normal window size. Name a campaign and two sessions. Verify the new session continues the same map discoveries and token state.
- [ ] Keep a map visible, import/choose another and change its setup/fog privately. Confirm the real player monitor stays on the original map until **Show to Players**. Check blank/show in both situations.
- [ ] Resume a prepared location in another session. Reuse its library resource in another campaign and verify fresh progress. Try a deliberate fresh copy in the same campaign; name copies distinctly.
- [ ] Save updated library defaults and verify existing locations stay unchanged. Confirm a new copy uses those defaults and starts covered with placement locked.
- [ ] Register a named NPC, move it to another map and back, and verify name, artwork, visibility and single placement. A move removes the old placement immediately; deleting it deletes the identity.
- [ ] Save a monster/player/NPC template and spawn several copies. Verify independent settings and positions. Test player controls on actual phones with this review port.
- [ ] Create an Old House group, add prepared floor maps, navigate by floor, privately preview and deliberately publish. Confirm grouping alone creates no stairs/portal behavior.
- [ ] Switch campaigns: the table blanks and Wi-Fi turns off. Return and resume progress. Close/restart the review app, export a backup and restore into a new folder.
- [ ] Check actual table monitor scale, native/browser display, sound, QR scans and normal play. The optional native runtime is installed separately per application folder if used.

## Scope and design decisions

TM-A through TM-F are implemented for review. Sessions reference campaign-owned continuing locations; they are not historical rewind snapshots. Reusable resources store preparation defaults; existing map instances keep explicit preparation snapshots and independent game progress. Named NPCs use the existing token model with a campaign identity reference; templates use the same fields and generate independent instances. Groups reference resources, not exclusive copies or spatial connections.

TM-G advanced staircase/portal connections remains optional/deferred. No new walls, doors, combat rules or statistics are introduced. No accepted-release replacement or human acceptance is inferred from automated results.
