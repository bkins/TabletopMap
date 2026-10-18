# Embedded Arcana dice roller

Copied from the existing sibling D&D dice project (`../..`) on October 4, 2026: dice engine, 3D renderer, UI logic, markup and styling. The sibling project is unchanged.

Integration changes are limited to a compact embedded layout, removal of the remote Google Fonts import, and scope-specific storage keys. The original d4/d6/d8/d10/d12/d20/d100 builder, custom expressions/modifiers, single-d20 advantage/disadvantage, animations, 3D toggle and 30-roll history are retained. The parser and roll engine are unchanged.

The map app serves only the five runtime files on an explicit `/dice/` allowlist, including to Wi-Fi clients when Wi-Fi access is enabled. This README and other server files are not public dice routes. `scope=dm` isolates DM history; player controllers use `scope=character-<generated-id>` to keep each character's history and 3D preference separate. Frames isolate CSS and keyboard shortcuts from the map/movement UI. Rolls/history are local to each browser and are not broadcast to the party or saved in campaign backups.

Engine regression tests are in `test/dice.test.js`; the integrated DM/player browser checks are in `test/character-browser-check.js`.
