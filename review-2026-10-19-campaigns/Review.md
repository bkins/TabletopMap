# Campaign-management review candidate

Identity: **0.4.0 / campaign-management-2026-10-19-v1**. [Exact runtime hashes](SHA256SUMS.txt) and the branch commit identify this candidate. Frozen source files are retained in the local review folder. Accepted 0.3.0 source/data/release remain separate.

Open **http://localhost:5190/** on this computer, or run `Start-Review.cmd` from the candidate folder. Review data was copied from a consistent read-only export of the original campaign; fog, calibration, tokens and assets were compared after migration. The review copy has Wi-Fi disabled. Its own `data/` contains the original backup and permanent pre-migration snapshot; those are private local files and are excluded from GitHub and the downloadable review ZIP.

## Delivered for review

- TM-D/B: campaigns with named continuing sessions; shared resource defaults and independent campaign locations; original-save migration and schema-2 downgrade protection.
- TM-A: private DM preparation/selection and explicit Show to Players, with live player-map status/preview and phone movement still bound to publication.
- TM-C: persistent named NPCs on the existing token model; deliberate relocation; independent reusable template instances with fresh credentials.
- TM-E/F: named groups referencing reusable resources, private group/floor navigation and explicit publication.
- TM-G: optional physical staircase/portal connections remain deferred; no new gameplay need has been established.

## Automated evidence

47/47 unit/HTTP checks pass, none skipped. Complete campaign browser workflow and existing mode/save/compass/core-map/character/profile browser regressions pass in Chrome. Actual player pixels verify private preparation versus publication. Migration, independent campaigns, continuing sessions, NPC/template identity, group navigation, backup/restore/restart, invalid metadata and empty-session edit safety are covered. Test command helpers handle bounded expected revision races; production stale-write rejection is retained.

[Setup screenshot](campaigns-setup.png) · [Game-Play screenshot](campaigns-play.png) · [Mobile screenshot](campaigns-mobile.png)

## Human review

Follow [CAMPAIGN-REVIEW.md](../CAMPAIGN-REVIEW.md). Human usability and physical display/phone/audio acceptance remain pending. New sessions share continuing location progress, not historical rewind snapshots. Library updates affect future copies only. Moving an NPC removes the old placement immediately; deleting it removes its identity. The live preview remains the published map, so preview drag/resize is disabled while privately selecting another map.

The complete workspace uses schema 2. Keep review data separate from the accepted 0.3.0 installation; older binaries deliberately reject it. No release promotion is implied by automated results.

