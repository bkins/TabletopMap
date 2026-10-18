# Tabletop Map — Phase 1

A local, offline browser application for gradual discovery at an in-person D&D table. The DM sees the complete player-facing map, editable discovery, and a player composition preview. The table window shows only the composited revealed map. Physical miniatures stay in place because table geometry starts locked and can only change deliberately from the DM controls.

## Start

Requires Node.js 22 or newer and a modern browser (Chrome or Edge recommended for the first physical trial). The default Browser display has **no runtime package installs, remote fonts, CDNs, account requirements, or build step**. The optional Windows display has a one-time installation described below. The QR encoder is bundled with its MIT license. Once Node and a browser are installed, play needs no internet.

On Windows, double-click `Start-TabletopMap.cmd`. It starts the local server and opens the DM view after listening. Keep the terminal open throughout play. Alternatively, from this folder run `npm start`, then open `http://localhost:5180`. A port already in use is reported instead of starting a second server. Stop with Ctrl+C. Set `PORT` before starting to use a different port.

## Set up two displays

1. In Windows display settings, choose **Extend these displays**. Mirroring would expose your DM view.
2. Open the DM view on the laptop. Click **Open table display** and allow that popup if the browser blocks it.
3. Move the new window to the table monitor, then optionally click **Fullscreen · one monitor**. The map appears immediately without clicking fullscreen. Keep browser zoom at **100%** in both windows. Escape exits fullscreen. The player window has no pan, zoom, or drawing controls.
4. Confirm **Table connected** in the DM view. The reported dimensions should match the fullscreen table viewport. The embedded preview uses those dimensions to reproduce the table composition at a smaller size; it does not establish table connectivity.
5. Import a PNG or JPEG. Every import creates a new saved map, fully covered and blanked. Click **Show table** when ready: an unrevealed map still appears black.
6. Calibrate and lock the display before placing miniatures. A change in OS scaling, browser zoom, fullscreen state, or monitor resolution requires checking physical scale again.

The software lock protects the app's map transform; it cannot lock Windows display settings or the browser's own menus. Do not change those during play.

## Two table monitors plus the DM screen

Keep Windows in Extend mode and keep the current vertically stacked layout. For two end-to-end 1920 × 1080 table monitors, with the upper one already set to Landscape (flipped), stretch the player window across both. Windows handles the flipped screen; do not rotate it again in the app. Leave **Fullscreen · one monitor** alone while spanning: browser fullscreen targets one monitor. Browser bars remain in a stretched window. For borderless spanning, choose the optional Windows display described below. Match browser zoom and display scaling and recheck physical square size after resizing.

## Discover the map

- Choose **Reveal** or **Cover**, then Brush, Rectangle, or Polygon. Drag brushes/rectangles; click polygon vertices, then **Enter** or **Finish polygon**. Esc cancels the unfinished shape. Cover is opaque black on the table.
- Brush size is measured in source-image pixels. Revealed rooms stay visible until covered. Disconnected shapes remain independent.
- Undo and redo operate on the current map. New edits after Undo discard only the redo branch. Undo history itself is saved across restarts.
- **Reveal all** and **Cover all** require a confirmation and are undoable. They do not erase your earlier history.
- **Blank table / Show table**, or Space outside input fields, toggles the entire player display without changing discovery. Blank is saved.
- Wheel zoom and middle-button drag change only your DM view. Alternatively choose **Navigate DM view** to pan with the left button. **Fit DM view** does not move the table.
- Selecting a saved map preserves each map's discovery and calibration, and blanks the table until you choose Show table.

## Compass overlay

Enable **Show compass on map & table** in the DM's **Compass overlay** controls. Enter north's clockwise angle from the original map's top and click **Apply compass angle**, or use the 15° turn buttons. At 0° north points up; at 90° it points right. The compass stays in the upper-right corner of the DM canvas, player table, and table preview. Rotating the table map also turns the compass to preserve north relative to the map. Its angle and visibility save separately for each map and are included in session backups. Older maps start with the compass hidden. You can adjust the compass while table position is locked. Blanking the table hides it with the map.

## Calibrate for physical miniatures

1. Deliberately unlock the table. Remove or record any miniature positions before changing geometry.
2. For an existing map grid, choose **Calibrate: two grid points**. Click two *adjacent* intersections along one horizontal or vertical grid line. This fills map pixels per square and the grid origin. Apply calibration afterward. Do not click opposite diagonal corners.
3. For a gridless map, enter pixels per square, set an origin, and enable **Add grid overlay**. The overlay appears only in revealed areas.
4. Set desired square size, normally **1 inch**. Monitor CSS pixels per inch initially defaults to **96**; this is an estimate, not a hardware measurement.
5. Apply grid & physical scale, reveal a calibration area, and measure a square with a physical ruler. Compute **new PPI = old PPI × desired square inches ÷ measured square inches**. Enter it and reapply. Repeat until a square measures correctly.
6. Adjust X/Y offsets and **Rotation (degrees clockwise)** deliberately if needed, then **lock** the table. Enter an angle and click **Apply table position & rotation**, or use the 90° turn buttons. Rotation turns the image, grid, and fog together, appears in the preview, and is saved per map. It preserves the physical scale. The DM drawing view keeps its original orientation. X/Y locate the top-left of the rotated image's bounding box. Existing saved maps default to 0°.
7. **Fit map to table** fits the rotated image to the screen; it does not preserve one-inch squares. Reapply physical calibration after fitting if using physical minis.

The preview is scaled to fit its panel and is not a ruler. Check scale on the actual table monitor. Grid calibration and physical scaling can fail validation if values would produce a scale outside 0.01–20; enter practical positive values.

## Saves, backups, and recovery

All digital tokens snap to the center of a complete grid square. Each square holds one token, including hidden monsters and NPCs. DM placement and player movement into occupied squares show an error and leave the token in place. New tokens use the nearest free square. Loading older saves or changing grid calibration snaps existing tokens and separates overlaps into nearby free squares. Partial squares at map edges cannot hold tokens. Player directions follow the table rotation using the nearest grid direction.

The authoritative data lives in `data/` beside the app (or in the directory named by `TABLETOP_DATA`). It contains original map images, `session.json`, and a previous-save copy `session.json.bak`. Every committed visibility, blanking, map-selection, calibration, and table-position change saves before it is broadcast. A failed save shows an error and does not apply the change. Import copies the image, so the original file may be moved afterward. The DM's temporary pan/zoom is independent and is fitted on reopen; table position/scale are saved.

Do not delete `data/` or clear it to troubleshoot. There is no destructive reset/delete UI. Export a **session backup** before experimenting or moving computers: it includes map assets and all saved state. Keep another copy outside this project. OneDrive sync is not a replacement for a backup; avoid running this same data folder on two computers concurrently, and use a local `TABLETOP_DATA` directory if sync causes file-lock errors.

To restore an exported backup, run `node restore-backup.js "path-to-backup.json"`. It validates the bundle and always creates a **new** `restored-…` folder. Stop the server and use the printed PowerShell command to start with that folder. Existing saved data is never overwritten by this utility.

If `session.json` is corrupt, startup stops rather than resetting progress. With the server stopped, preserve a copy of the whole data folder, then copy `session.json.bak` over `session.json` (previous save), or restore an exported bundle into a new folder. Do not run two servers against the same data directory.

## Checks and limits

Run `npm test` for the model, persistence, and local HTTP tests. The optional browser suite is `node test/browser-check.js`; install Playwright for development with `npm install --no-save playwright` and `npx playwright install chromium` first. This does not add any runtime dependency. `PLAYWRIGHT_MODULE` and `CHROMIUM_PATH` may point to an existing test runtime.

See [VERIFICATION.md](VERIFICATION.md) for exact automated evidence and the remaining physical/group checklist, and [ARCHITECTURE.md](ARCHITECTURE.md) for the design. Phase 1 is implemented; human acceptance is pending. The automated suite simulates two browser clients; it cannot certify a particular monitor, an entire offline game session, or usability at your table.

The original manual-map release is preserved at Git tag `phase-1-manual`. The character extension is on branch `benny/character-minis`. Campaign backups are in `data/backups/before-character-minis.json` (before development) and `data/backups/before-character-upgrade-live.json` (immediately before the live server upgrade). Maps are capped at 40 MB, 40 megapixels, and 12,000 pixels per side. Large maps should be trialed on the actual laptop before play. Character radius reveal is geometric; no walls, doors, movement rules, or lighting simulation are included.

## Optional digital character minis and phone controls

If the DM page was open before the October 6 save-queue fix, refresh it with **Ctrl+F5**. Adding a token now waits for an automatic display-size save to finish. No server restart is needed for this update.

Existing maps start with character mode **off**, so your manual-fog workflow is preserved. Each map has its own characters, positions, radius settings, and exploration memory. The initial minis are colored circles with character initials, sized to fit within a calibrated square.

1. In **Character minis · optional**, enter a name and add a character. Select a character to set its name, color and reveal radius in **map grid squares**, then save. Radius 6 means six grid squares, not six feet. Set 0 for a visible mini without automatic map reveal.
2. Use **Place selected mini on map**, then click a starting position in the DM map. X/Y fields provide precise source-map coordinates. This does not change table scale/position, and character movement works while the table geometry is locked.
3. Enable **digital minis & radius reveal** when ready. Everyone sees the union of the party's circles and manual DM reveals on the shared table. Circles reveal through walls; check the radius before play. Each character's current radius always wins over manual cover. Manual covering can hide old exploration outside current circles.
4. Choose **Keep explored areas visible** or **Current radius only**. Retained exploration is separate from manual fog and survives restarts. Switching to current-radius mode hides the retained trail without deleting it; switching back restores it. Manual reveals stay visible in either mode. Disabling character mode hides the minis and all character exploration, restoring the manual-only composition.
5. Enable **Allow player controls on Wi-Fi**. Put the DM computer and player phones/tablets on the same trusted local network. Copy each selected character's **private player control link** and give it to that character's player. Links contain a secret that grants control of one character; keep them private. A guest network with client isolation may prevent connections.
6. Open the link on a phone. The large arrow pad moves one square per tap in the direction seen on the rotated table display; diagonal buttons move one square on each axis. Players look at the table monitor while moving. The controller shows only its assigned character and status, not the source map or DM controls. It waits when its map/mode is inactive and retries after connection loss. A move with an uncertain timeout is not automatically resubmitted, to avoid moving twice.

If Windows asks about Node.js firewall access, allow it on your **private network** for phone control. This has not been automatically configured. Turn off the Wi-Fi option to revoke remote access for all players. Removing a character revokes that character's link; create it again to generate a new link. **Test controls** opens a local controller window for DM testing even with Wi-Fi disabled.

The app lists links using the first detected network address. If your computer has several adapters (including VPNs), replace the IP in the copied link with the DM computer's actual Wi-Fi/LAN IPv4 address, preserving the port and `#…` character secret. No internet, external service, or account is needed. This is a local-network HTTP app; do not port-forward it or publish the links on the internet.

Character settings/positions/exploration save automatically before updates reach the table. Player movements are serialized so multiple players can move without overwriting one another. Fog Undo/Redo remains for the manual DM operations; character movement does not fill that history. **Clear character exploration** explicitly clears only the trail; manual fog and current character circles remain. Export a backup first if you need to restore a trail later. Phone movement has no rule-enforced speed, collisions, or turn order.

To check the extension: `npm test`, plus the optional browser suite `node test/character-browser-check.js`. See the character extension section in `VERIFICATION.md` for automated evidence and remaining real-device acceptance.

## Players customize their characters

Restart the local server and refresh the player pages after this update. On a player's private control page, open **Customize character**, enter a name and choose an avatar image, then click **Save character**. PNG, JPEG and WebP files up to 8 MB are supported; the image is center-cropped and reduced to a 256 × 256 PNG. **Use initials instead** removes the avatar when saved. **Cancel changes** discards unsaved edits.

Players can prepare their assigned character before the DM activates digital minis. Name and avatar save with that character's map, appear in the DM controls, and show on its visible table mini. The private link and dice history remain the same after renaming. Background refreshes preserve unsaved edits. Players edit only their own name/avatar; reveal radius, visibility, token type, map geometry and other characters stay under DM control. Existing campaign backups include saved names and avatars.

## Scan to join — player QR codes

Restart the local server and refresh the DM/table pages after this update. Enable **Allow player controls on Wi-Fi** and **digital minis & radius reveal**, then select a visible player character. Choose your computer's Wi-Fi address in **Player Wi-Fi address** (especially if VPNs or multiple adapters are listed) and click **Show QR on table**. A QR card appears on the shared table display and in the DM preview. Show the table before displaying invitations; blanking revokes the codes. The player scans it with their phone camera and opens their assigned controls. Their phone must use the same network; Windows firewall/client isolation still affect connectivity.

Show one player's code at a time. **Hide table QR** restores the display; the card also hides after two minutes, on emergency blank, a map change, character removal/hiding, disabling character mode, or disabling Wi-Fi. Showing a code changes no fog, map geometry, character positions or saved session state. The code contains the character's private link: anyone scanning it can use those controls. The two-minute limit hides the card; the character link remains valid until that character is removed.

QR generation stays entirely on this computer using the bundled encoder. Phones receive only the existing assigned-character controls; DM pages and full map assets remain inaccessible over Wi-Fi.

## Dice on the DM and player pages

Expand **◇ Dice roller** below the DM table preview or below a character's movement pad. This embeds the existing Arcana roller from the sibling dice project, including d4/d6/d8/d10/d12/d20/d100 shortcuts, dice quantity, modifiers, custom expressions such as `2d6 + 1d8 + 3`, single-d20 advantage/disadvantage, animated dice, and the optional 3D toggle. Press Enter while focused inside the roller to roll.

The last 30 rolls and the 3D preference save in that browser, separately for the DM and each character. Clear history affects only that roller's history. Rolls default to private/local; check **Share this roll on the table** before rolling to broadcast a new roll. Histories are not included in campaign exports. Browser storage clearing removes roll history. The integrated roller needs no internet and uses bundled assets/system fonts. Map drawing, movement and dice keyboard shortcuts are isolated in separate frames.

## Encounters, artwork, shared rolls & atmosphere

- **Monster and NPC tokens:** In **Characters & encounters**, choose a token type, enter a name, and add it. Encounters start hidden. Select a token, place it on the map, check **Visible to players**, and save when ready. Hidden tokens have a dashed gold border in the DM map and never enter the player snapshot. Visible encounters are clipped by fog and do not reveal any area; they work even with player character mode disabled. Monsters and NPCs have no player control links. The 30-token limit includes all token types.
- **Artwork:** Select any token and upload a PNG, JPEG or WebP up to 8 MB. Images are center-cropped into a 256-pixel square, drawn as circular minis, and saved with the map and backup. Choose **Use initials instead** to remove artwork. Player artwork also appears on its phone controller. No image service or internet is required.
- **Shared dice:** Check **Share this roll on the table** in the DM or phone roller before rolling. Sharing defaults off each time the roller loads. The server generates the result, returns that same result to the roller, and shows the assigned character name (or DM), expression, total and individual dice on the table. Advantage/disadvantage identifies the kept die. Phone sharing requires that character's active, visible player mode and follows the Wi-Fi access setting. Up to three cards appear, expiring after 12 seconds; blanking and disconnect hide them. Cards are transient and do not survive server restart or enter backups. Private rolls still run locally. A timeout is never retried automatically; check the table before rolling again.
- **Atmosphere:** Choose rain, embers, mist or no visual effect; independently choose rain, fire, wind, cavern or no sound, then **Apply atmosphere**. Settings save per map. Sounds are synthesized locally, rather than downloaded recordings. Sound defaults off and requires clicking the table window's fullscreen prompt or **Enable sound**; use **Mute sound** to silence that window. The DM preview is always silent. Blanking or a detected disconnect hides effects and stops sound. Effects cover only revealed map areas and never change scale, rotation, discovery or miniature positions. Reduced-motion preferences suppress moving rain/embers and make mist static.

Refresh existing DM/table/phone pages after upgrading. The pre-change campaign bundle is preserved in `data/backups/before-table-extras.json`; the immediate pre-restart bundle is `data/backups/before-table-extras-live.json`. Run `node test/extras-browser-check.js` alongside the original browser checks. Automated verification is recorded in [VERIFICATION.md](VERIFICATION.md); real phones, speakers and table usability remain human checks.

## All player QR codes

In **Characters & encounters**, enable digital minis and Wi-Fi player controls, then choose the computer's Wi-Fi address. Select **QR placement → Corners, top & bottom** and click **Show all player QR codes**. All visible player characters receive separate labeled codes; monsters, NPCs and hidden players are excluded. The edge layout anchors two codes to opposite outer corners. Larger groups fill the corners and then the outer top and bottom edges, keeping the join clear. Choose **In the center** for a centered group. **Show QR on table** still shows only the selected player using the chosen placement. **Hide all table QR codes** clears the display. Codes expire after two minutes; click Show again if needed. Blanking, disconnecting Wi-Fi, switching maps or disabling digital minis revokes them. Scan each player's own code with a phone on the same Wi-Fi.

## Position the player map from the DM preview

Refresh both DM and player pages after the October 16 placement update. Above **Table preview**, click **Unlock placement…** if locked. **Best fit & center** fits the entire map to the connected player viewport, comparing its current angle with a quarter-turn and choosing the larger fit; equal fits retain the current angle. **Fit current angle** centers without turning. Drag the preview to move the player map; scroll over it or use **− / ＋** to resize. The preview shows the adjustment while dragging and applies it to the player screen on release (scroll applies after a brief pause). Escape cancels an unfinished adjustment. Click **Lock placement** when finished. Changes save per map; fog, tokens and grid settings are preserved. Fit and zoom change physical square size, so measure/calibrate again if using physical minis. The player screen itself remains read-only.

## Optional Windows display: fill both table screens

**Browser display remains the initial default and needs no new installation.** Both methods use the same server, player renderer, saved campaign, DM controls and phone links. Switching methods does not reset map/fog/tokens. The chosen method and screen pair are remembered in that DM browser only; opening a page never automatically opens a native window.

On this development laptop the optional component is installed already. On another Windows PC, first install Node.js 22.12.0 or newer, then run `desktop/Install-Windows-Display.cmd` once with internet access. It installs the pinned Electron 44.8.0 runtime. After installation, normal play works offline. The original October 14 ZIP does not include these changes.

1. Start/restart Tabletop Map and refresh the DM and player pages after this update.
2. In **Player display → Display method**, choose **Windows display · fill two screens**. This discovers connected screens. **Find connected screens** refreshes that list.
3. Choose the upper and lower table screens. The main DM screen is excluded. Both must use the same Windows scaling and form one rectangle in Display Settings, with no gap. Windows handles the flipped upper screen.
4. Click **Fill both table screens** (also available in the top bar). One borderless, fixed-position window fills both monitors using their full display bounds, not the taskbar work area. It stays above windows on those two displays; the main DM display remains available. No Windows snapping, taskbar or display settings are changed.
5. Use **Best fit & center** from the DM preview if needed, then check physical grid size and lock placement. The new viewport is 1920 × 2160 for two stacked 1080p screens. Existing transforms are preserved until you deliberately fit or adjust them.
6. **Enable sound** in the native player window if desired. While Windows display is active, refreshed browser player windows suspend their atmosphere/sound to prevent two windows playing at once; they resume when Windows display closes if previously enabled. The DM preview stays silent.
7. Press **Escape** or click **Close display · Esc** in the player window to close it; **Close Windows display** in DM controls also closes it. **Use Browser display instead** closes the optional component and opens the established browser player window. Selecting **Browser display** in the dropdown also closes the optional component; click **Open table display** if you need a browser window.

An unplugged monitor or changed display layout closes the native window rather than covering another screen. Refresh the screen list before reopening it, or use Browser display. If the optional component fails, the error stays in the display section and Browser display remains available. Test actual taskbar coverage, the monitor join, Escape, sound, QR scanning and physical scale on the table; automated window bounds alone do not certify those experiences.

Runtime and security references: [Electron BrowserWindow](https://www.electronjs.org/docs/latest/api/browser-window), [display coordinates](https://www.electronjs.org/docs/latest/api/screen), [security guidance](https://www.electronjs.org/docs/latest/tutorial/security).
