# 05 · History and design decisions

Newest first. The commit hashes are on `main`.

## 5 Oct 2026

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
