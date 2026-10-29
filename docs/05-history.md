# 05 · History and design decisions

Newest first. The commit hashes are on `main`.

## 29 Oct 2026

- Canyon planner: added a white layer over the map image with a "White mask" slider (0–90 %, default 30 %). The value is a per-viewer setting in `localStorage` (`fox-canyon-war-room-v1-mask`), not part of the plan, and the Create plan JPEG uses the current value.
- Added the Canyon planner to the Alliance tab for R4s and admins (`canyon.html` in an iframe). It is the Foundry planner's code with the Lost Canyon map: 94 buildings at the positions read from the WoSTools Canyon Clash Planner, chips drawn over the codes printed on the map, Fortresses closed until 20:00 and the Frozen Citadel until 40:00, and an "Our territory" button instead of "Swap sides". Plans use their own localStorage keys (`fox-canyon-war-room-v1-L1` / `-L2`).
- Added the Layout planner to the Alliance tab for every member (`layout.html` in an iframe, built and tuned with Adrian as a Claude artifact first, 25–29 Oct). Same pattern as the Foundry planner: self-contained, no Supabase. Each member's layout stays in their own browser under keys suffixed with their account id, so members never overwrite each other; a shared Supabase table can come later if the alliance wants one official layout.
- The generator went from rows, to a pinwheel spiral, to spiral plus compaction after Adrian showed by hand that sliding a group of cities one tile pushes the corner holes outward (closer cities, fewer banners).

## 26 Oct 2026

- Added the Foundry planner to the Alliance tab for R4s and admins (`foundry.html` in an iframe, built and tested as a Claude artifact first). Kept it self-contained to avoid CSS clashes with `style.css` and to keep `app.js` changes to the tab wiring only. Plans stay in each browser's localStorage; a shared Supabase table can come later if the R4s want one live plan.

## 16 Oct 2026

- Added each Hero Widget's generation beside its Backpack item name using the Widgets planner roster; item IDs and saved quantities are unchanged.
- Kept the page navigation for planners sticky below the header, including when the phone header hides during downward scrolling. The header height is measured so the bar does not overlap it when it returns.
- Corrected the Building planner's partial-level labels. An internal stage index of 33 is FC 6 · 3/5, so FC 6 · 3/5 → FC 7 sums only the final two stages (360 FC, 45 RFC). The prior `ceil(n/5)` label showed that index as FC 7 · 3/5, causing members to select an earlier index and see excess costs. Saved numeric stage indices are preserved; members should review any saved partial-level selections.

## 15 Oct 2026
- Replaced the Hero Gear planner tile's line icon with a transparent boot cutout from Adrian's screenshot, without the level badge or card background.
- Replaced the War Academy, Pets and Chief Gear planner tile line icons with transparent cutouts from Adrian's screenshots.
- Replaced the Experts planner tile's line icon with a transparent cluster of Adrian's three Expert portraits, without their frames or level labels.
- Replaced the Chief Charms planner tile's line icon with a transparent cluster of Adrian's three charm gems, arranged in a slight overlap.
- Replaced the Buildings planner tile's line icon with a transparent Furnace cutout from Adrian's screenshot, without its nameplate or background.
- Added a standalone Widgets planner tile for all 16 Gen 1–5 mythic heroes, with current and target levels, per-hero material costs, account save, and reviewed Backpack Target transfer. Source conventions are in `docs/widgets-notes.md`.

- Removed the Widgets section from the Hero Gear planner and excluded widget costs and points from its totals, while preserving saved legacy widget values.
- R4 task rows now highlight assignment gaps: red with no assigned R4, orange with one, and a numeric badge for both states.

## 14 Oct 2026

- Removed the unavailable Troops placeholder tile from All planners.
- Confirmed the existing Experts planner still uses the current WoSTools catalogue chunk and removed a duplicate disabled Experts tile from All planners.
- Pets planner prepared from WoSTools' public pet catalogue: all 14 pets, level and advancement costs, unlock warnings, material and Wild Mark SvS points, account plan save, and Backpack Target transfer. Source conventions and limits are recorded in `docs/pets-notes.md`.

## 6 Oct 2026

- **Experts planner** (cache tag `20261006-experts`): catalogue extracted from WoSTools, mockup validated by Adrian, General Expert Sigils target = what own sigils do not cover (his choice).

## 5 Oct 2026

- **SvS date editable by admins**: a date picker and Save on the Reference tab (admin only) calls `set_next_svs()`, then reads the date back before saying Saved. Front-end first built and tested, SQL run by Adrian before the deploy.
- **Backpack group names**: the Day number in a group name (e.g. `Speedups (Day 1)`) is hidden on display by a regex in `renderStock()`; the database still holds the full `user_items.grp`. Adrian asked for it because the Day split is now covered by the SvS prep guide, not by the tracker.
- **Languages**: Spanish, Turkish and Norwegian added through `i18n.js` and `i18n-data.js` (about 400 texts). Chosen over editing every string in `app.js`: it changes no app logic, falls back to English per text, and switches instantly. Item and building names stay English because data is joined by name; whether members play in English or in their own language is still to confirm with Adrian.
- **Steel icon**: `item-steel.png` (cut out of an in-game screenshot Adrian supplied, 128 px, transparent) added to `ITEM_ART` and to the War Academy materials list (it was `null` there).
- **Backpack export** (cache tag `20261005-export`): an Export chip on Backpack opens a full-screen sheet of small cards (game icon, Have in green or red, Target) drawn on a canvas and saved or copied as a PNG. Designed first as an Artifact mockup with Adrian: icon-led cards, no names, and every card visible on one phone screen.
- **Phone fix** (`bd2579e`): exchange rows now hide with their folded group. The phone rule for `tr.xch` beat `tr.hide`.


## 2 Oct 2026

- **Free/day counts only rises.** `recomputeFree()` summed first-vs-last snapshots, so any spending in the 90-day window (Adrian's General Speedups) pulled the net change to 0 and the rate showed 0.00. It now adds up the positive steps between consecutive snapshots, each with its own pack deliveries removed. Chosen by Adrian over a manual start date or a shorter window.
- `f73c1ea`, `97f2c28`, `6d3fcb2`: **R4 workload cards.** The "Tasks led / backing up" totals row (pairs like `11 / 6` running together, and hidden on phones) was replaced by one card per R4 under the table. Tapping a card filters to that R4.

## 29 Sep 2026

- `39cc1e8`, `a45f2d3`: **The weekly limit is the maximum enterable** for each gear exchange (it caps the quantity given). Adrian asked for it; whether the game caps given or received is still to confirm.

## 28 Sep 2026

- `6da72b4`, `5c66d34`: **Exchanges under six items** (Charm Guides/Designs both ways, the Design Plans / Polishing Solution / Hardened Alloy / Lunar Amber set). **Planned trades now move Have-based figures** (progress, Remaining, Dashboard) as well as Projected; an item in several exchanges sums them all. Adrian's requirement: "the progress bar must move too" and "Design Plans must capture every exchange".
- `ff614eb`, `1215997`, `0a8ae51`: first exchange (Charm Guides → Charm Designs, 2:1) and the new table `user_exchanges` (approved by Adrian).
- `63eccb1`, `4904b8c`, `c2b467e`: **password reset completion** plus the My password box. Before, the email link signed the member in but never asked for a new password.
- `20b0bc7`, `846bb2f`, `29cd549`: **emails removed from Members** (Adrian: keep them private). They are no longer even fetched.
- `cf02e8c`, `b5f8a81`, `e359b6f`: admin ▲▼ **reordering of R4 tasks** within a section.
- `6098ce2`, `53a2cd9`, `f6eb121`: R4 roles shown as **tick marks** instead of dots; the phone edit chips stopped overlapping (a 1% cell width bug).
- `2ccef75`, `cb953ab`, `e01f111`: **R4 editors.** Adrian names assistants on Members; they can only change ticks. This was designed as a server-side gate: the `r4_editor` column, `set_r4_editor()` (admin only) and `set_r4_role()` (admin or editor), while the table write policies stayed admin-only. Adrian explicitly wanted editors limited to ticks and himself as the only one able to appoint them.
- `bfd6917`, `0ee153a`: **the Members list stayed empty after a refresh.** `restoreTab()` clicked the Members tab before `checkAdmin()` had resolved, so `loadMembers()` saw `ADMIN = false`. Fixed by loading the list from inside `checkAdmin()` when the panel is open, rather than awaiting it (awaiting would have slowed every page load).

## 27 Sep 2026 (before this handoff series; edits made through the web editor)

- R4 roles tab added (tables `r4_members` and `r4_tasks`, seeded from the Leadership Roles sheet of the Excel workbook).
- **Measured Free/day** from `stock_history` snapshots (replacing the static estimate).
- **Packs are no longer counted twice**: "Bought" counts packs already bought, and their items are already inside Have.

## 19–23 Sep 2026

- Pack sections and groups made collapsible; Moonlight purchases counted in spending; the Moonlight Backpack group removed (the Moonlight script is now unused).
- Item emoji replaced by in-game artwork (38 icons); line endings normalised to LF with `.gitattributes`.
- Dashboard as the landing tab, member list with last seen, editable in-game name; phone layouts condensed.

## Older context

- The tracker started as an Excel workbook (`D:\WOS\SVS Tracking\SvS_Savings_Tracker.xlsx`: Backpack, Things to Buy, Pack Contents, Free Income, Leadership Roles). The site replaced it for members; the workbook is no longer synced.
- Pack values come from Torxim's WoS Corner at the state's settings (FC5-Gen5, SR 46, RSS 25), as credited in the footer.
- Until 28 Sep, every change was deployed by an AI agent driving GitHub's web editor in Adrian's browser (paste plus commit) and running SQL in the Supabase dashboard. Claude Code with a local clone replaces that.
