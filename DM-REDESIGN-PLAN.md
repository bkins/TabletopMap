# DM interface redesign — Phase 1

Candidate: app 0.3.0, `dm-modes-2026-10-19-v1`. The October 18 GitHub release remains a separate, unchanged package.

## Review and implementation plan

The app uses one server-owned saved session containing multiple maps, one active map, per-map tokens/fog/calibration, and transient browser-local DM navigation. Controls already operate on shared objects through a serialized save queue. Two modes can therefore be introduced as a presentation concern without server, route or schema changes.

1. Add accessible Map Setup / Game-Play tabs and retain the same canvas, player preview and DOM controls.
2. Put display configuration, map import/selection/backups, character preparation, compass and table calibration in Setup. Put discovery, invitations, atmosphere and dice in Game-Play. Keep token selection, position, visibility, Save and placement available in both modes. Keep Open display and emergency Blank/Show in the header.
3. Expose only appropriate canvas tools: Setup has private navigation, placement and grid measurement; Game-Play has reveal/cover shapes, placement and navigation.
4. Retain unapplied form edits by map/token identity across polling and mode switches. Successful saves clear only their own unchanged drafts; failed saves retain them. Retain pending save queue, DM navigation, partial polygon/grid measurements and connected player frames.
5. Run existing automated checks and isolated browser acceptance; document hardware/manual review and future stories.

## Existing constraints and decisions

- Selecting a saved map changes the server's single active map and blanks the player display. The existing confirmation is preserved and explained in Setup. Private preparation of another map requires Story A; tabs must not imply this exists today.
- Map definition and progress currently live in one saved object. Token identity and controller keys belong to each map. A new tab must not be persisted in those objects or used as a campaign/session boundary.
- Both modes edit the same token. Save token settings still saves the whole existing form. Unapplied hidden setup fields remain drafts until that explicit Save; the mode hint calls this out.
- Input drafts live only in the current DM page, not across reloads or application restarts. Newly loaded pages start in Setup. They do not reserve/lock state against another DM browser; applying a draft uses the existing server revision checks.
- Mode switches do not load pages, recreate frames, select maps, send mutations or reset DM pan/zoom. They retain pending polygons/measurements; finish them in their original mode. Existing saves continue independently.
- This phase adds no walls, doors, lighting engine, initiative system, campaign model, reusable resources, private preview, or map transitions.

## Manual review checklist

Use a backup or disposable campaign for destructive checks. Refresh the DM page to load this candidate; no server restart is needed for these UI files.

- [ ] Setup shows display, maps, grid/calibration, token preparation and compass. Game-Play shows discovery, player invitations, atmosphere and dice. Main canvas and table preview remain visible in both.
- [ ] Select a token in either mode; move it or toggle visibility and Save. Return to Setup and verify the same token changed. Try a hidden NPC/monster and a player token.
- [ ] Pan/zoom the DM canvas, switch tabs repeatedly, and verify navigation, active map, fog, token positions and connected table/phone controls are unaffected.
- [ ] Edit an unapplied grid size and token name; switch tabs and wait through polling. Return and verify drafts remain. Apply/Save and verify intended changes appear. Reload only after applying desired edits.
- [ ] Switch modes while a save is underway. Confirm it completes once. Try an invalid scale, correct it after the failure, and save successfully.
- [ ] Start a polygon in Game-Play, switch to Setup and back, finish it. Measure two grid points in Setup; switch away/back before applying. Verify incomplete work is retained.
- [ ] Confirm emergency Blank/Show and Open display work in both modes. With physical minis, keep placement locked during play. Check the existing Windows two-monitor display and browser fallback.
- [ ] In Setup, switch saved maps using the existing confirmation: table must blank. This is an active-map change, not private preview. Export/restart/restore retain normal progress.
- [ ] Use keyboard arrows/Home/End on the tabs, check focus and labels, and review usability at your normal window size and scaling.

Automation results and screenshots are recorded in `review-2026-10-19-dm-modes/Review.md`. Physical display, phone/audio and DM usability acceptance remain human checks.
