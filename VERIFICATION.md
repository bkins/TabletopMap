# Phase 1 verification

## Token grid occupancy — October 6, 2026

Tokens now occupy complete square centers, with one token per square including hidden encounters. DM/player collision errors preserve state; player errors remain visible across polling. New tokens find nearby free cells, and older saves/grid recalibration align and separate existing tokens. Token radius and stroke remain inside their cell at small grid sizes.

All 27 `npm test` checks pass, covering grid offsets, edges, arbitrary rotations, legacy overlaps, hidden occupancy, full/no-square failures, and serialized simultaneous movement into one destination (one succeeds, one is rejected). `node test/character-browser-check.js` passes using bundled Playwright and installed Edge against a disposable campaign: DM and phone collision messages, unchanged positions, snapped movement, fog, preview, dice, and no browser script errors. Physical phone/table acceptance remains human-owned.

## Display-save contention fix — October 6, 2026

DM edits now queue behind an in-progress save instead of rejecting Add token with “Wait for the current save to finish.” Queued edits check that the active map is unchanged. Table heartbeat dimensions refresh even when the saved revision is unchanged, and polling rechecks the save guard before scheduling a display-size save.

`node test/save-browser-check.js` reproduced the original rejection before the queue fix. The final check passes with a deliberately delayed display-size response: one click creates exactly one named token after the response completes, preserves reported dimensions, and raises no browser errors. It uses a disposable campaign. All 24 `npm test` checks and the character/phone/dice browser suite pass. The running server serves the updated script; existing DM pages require a refresh. Actual Android and second-monitor acceptance remain pending.

Recorded October 4, 2026. **Implementation and automated verification are complete; physical-monitor and gaming-group acceptance are pending.**

## Automated checks

`npm test`: 9 passing Node tests. Verified fog/history branching, server-side geometry/grid lock, invalid operation rejection, map import, revision conflicts, unrelated-origin write rejection, persistent undo/redo and calibration/position/rotation settings across server restart, backup export and restore into a new directory, corrupt/missing-save refusal when recovery data exists, failed-save rollback, and emergency blank publication during a delayed prior write. Rotation checks include angle normalization/validation, rotated fit bounds, and loading older saves with rotation defaulting to 0°.

`node test/browser-check.js`: passing Chromium browser suite with two isolated clients (DM at 1400 × 1000; player at 800 × 600), plus a preview client. Uses a synthetic PNG and canvas pixel checks. Verified:

- An imported map remains black both when blanked and when shown with no reveals.
- Two disconnected rectangular reveals leave the intervening corridor black.
- Undo/redo alter the correct region; brush cover and polygon reveal render correctly.
- A real DM pointer drag commits a rectangle.
- DM wheel zoom and player wheel/drag leave saved table geometry unchanged.
- Preview and player pixel samples match at the same viewport ratio.
- Actual rotation input/Apply and 90° button controls rotate map and fog together, preserve black unrevealed samples, match the preview, survive player refresh, and are disabled again when locked.
- Emergency blank/resume changes rendered pixels correctly.
- Refresh with delayed map-image loading remains black until the composition is ready.
- Simulated browser offline mode blanks; reconnect restores masked pixels; a subsequent new-map import still synchronizes and starts blank.
- No browser script errors.

The browser suite uses only local URLs; normal app files contain no external runtime requests. The recovery test exposed a stalled SSE stream after offline mode, which was fixed with an authoritative snapshot polling fallback. The final suite passes after that fix. The screenshot was visually inspected for layout. Browser test outputs live in ignored `test-results/`; synthetic campaigns use disposable OS temporary directories and do not modify live data.

These are sampled rendering and state checks, not proof of every possible frame, browser/OS failure, power interruption, hardware configuration, or a whole gaming session. Network-online/offline simulation does not replace physically disabling internet and playing on the intended equipment.

## Acceptance criteria mapping

| Criterion | Automated evidence | Remaining human check |
|---|---|---|
| 1. Import fully covered | PNG import and black canvas samples pass | Import actual PNG/JPEG maps on intended laptop |
| 2. Separate rooms/corridors | Disconnected masks, brush cover, polygon reveal pass | Trace real irregular rooms comfortably |
| 3. Prompt updates | Two-client state/render synchronization passes | Perceived latency with actual map sizes and hardware |
| 4. Undo/redo | History and rendered regions pass | Verify during actual play |
| 5. Independent DM navigation | DM wheel leaves table transform unchanged | Laptop/table extended-display workflow |
| 6. Locked miniature alignment | Server lock and player input checks pass | Physical ruler and miniature stability |
| 7. Restore progress/settings | Disk reopen preserves map history/calibration/position | Close/relaunch on the intended machine |
| 8. Safe lifecycle | Delayed loading, refresh, map import/switch, disconnect/reconnect samples pass | Watch intended monitor through lifecycle transitions |
| 9. Offline session | No runtime dependencies on internet; local browser checks pass | Complete a session with internet physically disabled |
| 10. Comfortable controls | Functional pointer drawing checked | DM and gaming group usability acceptance |

## Physical/group trial — not yet performed

1. Start in extended-display mode. Move only the player window to the table monitor and enter fullscreen. Confirm preview framing and connection status, including after fullscreen dimensions change.
2. Import representative PNG and JPEG maps, including the largest expected map. Verify a new map is black before revealing anything.
3. Calibrate adjacent grid intersections, then use a ruler to establish one-inch squares on the monitor. Verify the optional overlay on a gridless map.
4. Before placing miniatures, test 90° and arbitrary-angle rotation, rotated fitting, and measured square size. Place miniature bases at several intersections, lock the table, and navigate/zoom the DM view. Attempt wheel/drag on the player window. Check bases remain aligned and rotation controls are disabled. Record that changing OS/browser scale is outside the software lock.
5. Reveal two separate rooms, an irregular polygon and a corridor; cover one area, undo and redo. Check edges, latency and ease of use.
6. Exercise Space/button emergency blank, then resume. Switch maps, refresh player view and close/reopen its window while watching for any unrevealed pixels. Check connection indication after the player window closes.
7. Close both browser windows and stop the server. Restart and verify discovery, redo history, grid, scale, position and lock. Export and restore a backup into a new directory.
8. Disable external internet while keeping the extended monitor connected, then play a complete session. Record responsiveness, any interruptions and DM/group feedback.

Record this trial separately from automated results. Human acceptance has not been inferred from the passing suite.

## Optional character extension — October 4, 2026

The manual release is preserved at tag `phase-1-manual`; development continues on `benny/character-minis`. The campaign was exported to `data/backups/before-character-minis.json` before development and again to `data/backups/before-character-upgrade-live.json` immediately before the live server upgrade. Original maps migrate with characters and Wi-Fi disabled.

`npm test`: **15 passing tests, none skipped**, including the original checks. Added checks cover character ownership, private-key exclusion from public snapshots, default-off migration, both trail policies, table-relative rotated movement, map bounds, preservation of table lock/geometry/manual history, removal/revocation, saved positions/settings across restart, and LAN route restrictions. The LAN test connects through a detected non-loopback IPv4 address: it verifies disabled-by-default access, own-character controls, rejection of DM/state/asset/backup/table routes, wrong-key rejection, and access revocation.

`node test/browser-check.js`: original manual and rotation suite passes.

`node test/character-browser-check.js`: new DM + shared table + mobile touch-controller + preview suite passes. Checks actual DM creation/settings/enable controls, bounded circle rendering, a touch movement through the local-interface control URL, retained exploration, current-radius concealment of departed ground, preserved manual reveals, matching preview, manual-only restoration when disabled, paused player controls, exploration restoration after mode toggle/refresh, emergency blank hiding minis, and absence of browser errors. The 390 × 844 touch-controller layout was visually inspected.

**Human checks still pending:** connect actual phones/tablets on the intended Wi-Fi (including firewall/client-isolation setup); calibrate and compare digital/physical mini bases; check directions with the physical monitor's orientation; move several players during a real session; assess latency with the actual map size; try both exploration modes and verify that radius-only visibility through walls is understood. Circle reveal is not wall-aware dynamic lighting, and the first minis use colored initials rather than uploaded character artwork.

## Embedded dice extension — October 4, 2026

`npm test`: **21 passing tests**, including six tests reused from the original dice project for mixed groups/modifiers, advantage/disadvantage, invalid expressions and limits, mode eligibility, and random die bounds. The LAN route test permits only explicitly bundled dice runtime files while still denying DM/map/backup routes.

The character browser suite now also expands both dice panels, rolls a mixed expression on the DM page, checks 3D advantage rendering and the kept die, rolls a d6 through the mobile touch controller, verifies independent DM/player histories, reloads the player page to confirm history persistence, and compares character state/blanking/table lock before and after rolling. No browser script errors. The original manual/rotation browser suite also passes.

The source dice engine and 3D renderer were copied unchanged from the sibling project. The embedded copy removes external font requests and uses scope-specific storage. Dice results/history remain local, with no campaign-state writes. Real-phone layout/animation comfort during group play remains a human check.

## Adventure tools — October 5, 2026

Version **0.3.0** adds monster/NPC tokens, uploaded artwork, optional shared dice and local atmosphere presets. The original campaign was exported before edits to `data/backups/before-table-extras.json`. The immediate pre-restart backup is `data/backups/before-table-extras-live.json`. Existing maps/tokens migrate without enabling effects or sound.

`npm test`: **24 passing tests, none skipped**. Added checks verify hidden encounter omission from player state, zero-radius enforcement, rejection of encounter controllers, validated inline artwork/removal, quiet atmosphere migration, calibration/fog preservation, authoritative shared-roll attribution and totals, advantage kept-die selection, throttle behavior, disabled Wi-Fi/missing/revoked keys, no saved revision/token mutation from rolling, atmosphere persistence, backup inclusion and transient shared cards across restart.

The original manual/rotation and character/dice Chromium suites pass. `node test/extras-browser-check.js` also passes with DM, table, preview and mobile touch clients, including the local LAN controller URL. Verified actual DM monster creation, hidden player snapshot, fog preservation when showing a monster, appearance after manual reveal with character mode off, uploaded artwork pixel rendering/refresh/backup, shared DM and phone results matching their local roller, identity attribution, masked effects, silent preview, audio gesture/reload behavior, emergency blank and simulated table disconnect clearing effects/sound/cards, reconnect/resume, reduced-motion rain suppression and no script errors. Generated DM, table and phone screenshots were visually inspected.

Visual review caught an opaque CSS background on the atmosphere canvas that obscured the underlying map even though canvas pixel samples passed; the overlay now explicitly uses a transparent background, checked in the browser suite and final screenshots. It also caught a pre-existing orphaned font-import fragment in the embedded dice stylesheet; removing it restores the intended dark theme without network requests. Phone sharing initially used a secure-context UUID API unavailable over ordinary LAN HTTP; correlation now uses local request numbering, verified through the LAN controller.

**Human acceptance still pending:** actual phone uploads/sharing and concurrent group rolls, token/artwork readability at physical table scale, visual effect comfort and large-map responsiveness, speaker volume/quality and the synthesized sound presets, and a full session on the intended equipment. Audio state checks cannot certify audible output or enjoyment. The full physical/group checklist above remains open.

The local server was upgraded on port 5180 after the second backup. A read-only comparison against that backup, normalized with migration defaults, confirmed unchanged maps, discovery, table geometry, active map, blank state and revision. The live DM HTML exposes the new controls; shared cards start empty. Existing browser pages need refreshing to load the updated scripts.


## Player QR invitations — October 7, 2026

`npm test`: **28 passing tests, none skipped**. New HTTP checks verify LAN denial of invitation APIs, Wi-Fi/character preconditions, local-interface address validation, transient state, no campaign writes or backup inclusion, Hide, emergency blank, Wi-Fi revocation without resurrection, and character removal.

`node test/invite-browser-check.js`: **passed** in headless Chrome. Decodes the actual rendered QR pixels using independent jsQR, compares the decoded URL with the selected player's LAN address/private key, opens that URL in a 390 × 844 browser and verifies the assigned character. Exercises the actual DM Show/Hide buttons, Wi-Fi revocation, and simulated two-minute client expiry; verifies saved revision and blank state are unchanged and no DM/table script errors occur. Requires development-only Playwright, sharp and jsqr; `PLAYWRIGHT_MODULE`, `SHARP_MODULE`, `JSQR_MODULE` and `CHROMIUM_PATH` can point to existing tools. No runtime installs are required for the app.

`node test/character-browser-check.js`: **passed**, including movement/fog, mode toggles, exploration, blanking, occupied-square rejection and DM/player dice/history checks.

**Human check pending:** restart the local server, refresh both pages, select the Wi-Fi adapter and scan from the actual table monitor with an actual phone. Confirm QR size/viewing angle, same-network connection, assigned character, and comfortable return to play after Hide. Automated decoding and a mobile viewport are not physical-phone acceptance.


## Player character customization — October 7, 2026

`npm test`: **29 passing tests, none skipped**. The new profile HTTP test connects via a LAN interface and checks private-key authorization, rejection of other token IDs and DM-controlled fields, invalid/oversized names/artwork, profile preparation before character activation, unchanged geometry/fog/exploration/other tokens, concurrent movement/profile persistence, restart persistence, avatar removal and deleted-link rejection.

`node test/profile-browser-check.js`: **passed** using headless Chrome and a 390 × 844 touch viewport. Exercises player name and avatar editing before activation, preservation through background refresh, arrow-key safety in the name input, square 256 × 256 avatar preparation, explicit save/reload, DM synchronization and actual avatar pixels on the table canvas, Cancel, return to initials, invalid-image handling, and no horizontal overflow or browser script errors. Uses the same optional Playwright environment variables as the character suite.

`node test/character-browser-check.js`: **passed**, including existing player movement/fog/mode/occupied-square behavior and DM/player dice/history.

**Human checks pending:** use a real phone's image picker with a personal avatar and verify crop appearance, name entry, save feedback and the mini on the physical table. Mobile viewport checks do not establish physical-device acceptance.


## DM workspace modes — 2026-10-19 local review

Candidate: `dm-modes-2026-10-19-v1`, application 0.3.0. `npm test`: **37 passed, none skipped**. `node --check app.js` and targeted `git diff --check` pass.

`node test/dm-modes-browser-check.js`: **passed** with headless Chrome, isolated temporary campaign and an ephemeral port. Covers Setup/Game-Play control visibility, one unchanged canvas and frame set, zero POSTs and unchanged saved/player map during switching, preserved private DM zoom, unapplied calibration/token drafts, the same token saved from Game-Play, delayed-save completion across modes, invalid-save draft retention/correction, keyboard tabs and no horizontal overflow at 390px. It saves desktop Setup/Game-Play and mobile screenshots.

Existing browser suites **passed**: `test/save-browser-check.js`, `test/compass-browser-check.js`, `test/browser-check.js`, `test/character-browser-check.js`. Updated the latter two to enter Game-Play before using its tools/dice. Core browser suite's first concurrent run hit its existing direct-command revision race; a subsequent run passed the full suite. Edge's automated launch exited early in this environment; these successful checks used installed Chrome. No live campaign mutation was used for testing.

Human checks remain separate: normal DM usability/scaling, physical display/phone/audio behavior and manual partial-polygon/grid-measurement workflows. See `DM-REDESIGN-PLAN.md` for the checklist and `review-2026-10-19-dm-modes/Review.md` for exact candidate hashes and frozen screenshots. The GitHub October 18 ZIP remains unchanged.


## Campaign management — 0.4.0 / campaign-management-2026-10-19-v1

**47/47 unit/HTTP checks passed, none skipped.** Ten new campaign checks cover schema migration/idempotence and an untouched permanent original disk snapshot, separate prepared/published maps, empty-session safety, continuing sessions, independent campaign progress and Wi-Fi blanking, explicit resource defaults/fresh copies, persistent NPC movement/templates, groups, published-map phone movement and cross-campaign credential rejection. Schema-2 saves missing workspace metadata and corrupt reusable map geometry fail validation.

**Complete workflow browser check passed** (`test/campaigns-browser-check.js`, Chrome): Village remains published while Castle is imported/revealed privately; actual blue Castle pixels appear only after publication; map groups and floor navigation, NPC identity movement, independent template spawns, continuing sessions, another campaign's clean resource use, full backup/restore/restart and mobile overflow all pass without page errors.

**Existing browser regressions passed:** DM modes/drafts/pending and failed saves, save queue, compass, core fog/rotation/blanking/disconnect, character/phone/dice and profile/avatar. Direct test commands now retry only expected revision races up to three times with an unchanged DM map; production revision rejection remains covered by HTTP tests. Core import expectation changed deliberately to preserve the previously published map.

The original port-5180 campaign was exported read-only and copied to the isolated review directory. Migration comparison verified identical fog operations/cursor, grid, geometry, tokens and assets; only the review copy disables Wi-Fi. Original source/data and accepted 0.3.0 release were not replaced. Test campaigns used temporary directories/random ports; review uses 5190. No physical-monitor/phone/audio or human acceptance is inferred. See CAMPAIGN-REVIEW.md.
