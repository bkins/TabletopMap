# Tabletop Map future capabilities

Ben authorized remaining backlog implementation on October 19 after accepting the Phase 1 interface. Stories TM-A through TM-F are implemented in the separate 0.4.0 review candidate; automated verification passes and human acceptance remains pending. TM-G remains optional/deferred as specified below. No repository backlog convention existed at review time, so these stable local story IDs provide a planning reference.

## Recommended planning sequence

Plan D's campaign/progress ownership and B's reusable-map state boundary together before migrating persistence. Then implement A's private preparation/publication, C's persistent identities (before reusable templates if tradeoffs require it), E's organization, and F's quick transitions. G is optional and follows explicit navigation needs. Implemented D/B ownership first, then A publication, C identities/templates and E/F organization/navigation. The accepted 0.3.0 release remains unchanged during review.

## TM-A — Multiple prepared maps and explicit player publication

As a DM, prepare and inspect another map while players continue seeing the current one, then explicitly choose **Show to Players**.

Acceptance: DM selection and player-visible map are distinct; editing/selection never publishes accidentally; publication uses saved fog/token/blanking restrictions; phones remain bound to authorized map/token identities; reconnect/backup/restore preserve the selected/published relationship. Test multiple prepared maps and switching back without progress loss. Depends on an agreed B/D ownership boundary, not necessarily their full UI.

## TM-B — Reusable map resources and continuing progress

As a DM, reuse a map definition (image, name, grid, dimensions, reusable environmental settings) while choosing either independent play state or continuation of an existing location.

Acceptance: independent campaigns never share fog, token placements or environmental progress accidentally; resuming the same location across sessions preserves progress; session references do not automatically clone/reset a map. Define schema migration and backup/restore compatibility before implementation. Coordinate ownership with D; supports A/E.

## TM-C — Persistent NPC identities, then reusable token definitions

As a DM, move Borin the Blacksmith between maps/sessions while retaining identity and relevant state. Subsequently create separate Goblins from one reusable definition.

Acceptance: named NPC continuity is prioritized; template-spawned instances have independent IDs, positions, attributes/status and visibility; definition defaults and instance state are distinct; one common model supports both uses. Define controller-key revocation/ownership and migration of existing per-map tokens. Coordinate with D/B; do not add a competing token system.

## TM-D — Campaigns, sessions and resumable continuity

As a DM, name campaigns and sessions, associate several maps and resume an interrupted adventure without resetting prior progress.

Acceptance: explicit campaign progress versus session-history ownership; a new session preserves previously opened doors/reveals/character state unless intentionally reset; campaigns are isolated; existing single-session saves migrate safely; backup/restore preserves identities and associations. Doors are an example of future state, not authorization to add door mechanics here. Design with B before persistent migrations.

## TM-E — Map groups

As a DM, organize reusable maps into named groups such as Old House (Basement, Floor 1, Floor 2), Goblin Caves or Royal Castle.

Acceptance: groups reference reusable maps rather than owning their definitions; a map can participate without being copied; no specialized Building/Structure entity; grouping does not imply spatial connections. Depends on B's resource identity and D's organization context.

## TM-F — Simple map transitions

As a DM, choose a related floor/location, preview it privately, then explicitly show it to players.

Acceptance: readable names and a simple selector; no internal IDs exposed; selection alone does not change the table; returning preserves progress; intentional publication remains required. Depends on A and E; requires no stairs/portal simulation.

## TM-G — Explicit map connections (optional)

As a DM, define optional staircases, ladders, doors or portals connecting map locations, with deliberate token transitions if needed.

Acceptance: organizational membership and spatial connections stay separate; explicit source/destination and safe token identity/visibility handling; DM controls publication; basic map/group navigation works without connections. Depends on A/B/C/F and a demonstrated gameplay need. Do not implement automatically after the other stories.


## Implementation evidence and remaining gate

Candidate: **0.4.0 / campaign-management-2026-10-19-v1** in `TabletopMap-Next`. TM-A/B/C/D/E/F are implemented, awaiting the review in `CAMPAIGN-REVIEW.md`. Existing saves migrate into one campaign/session; campaign locations own continuing progress, sessions reference them, and shared resources provide separate defaults. The new complete browser workflow and regression checks use temporary data, not the live campaign.

TM-G remains **Deferred / optional**. No gameplay need for automatic staircase, portal or token-transition connections has been established. Explicit group/floor selection and Show to Players fulfill TM-F without implementing TM-G.


## Release decision — October 19

Ben explicitly authorized merging and releasing all changes through 0.4.0 for a single demo version. TM-A through TM-F are released; DM usability/product acceptance remains pending. TM-G stays optional/deferred. Earlier review-only status records the implementation checkpoint.
