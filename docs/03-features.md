# 03 · Features and logic

## Core numbers per item: `calcItem(it)`

```
delta = exchDelta(it.name)            // planned exchanges, see below
have  = it.have + delta               // "effective Have"
proj  = have + freeRate(it) * days()  // Projected on SvS day (can be negative)
have  = max(have, 0)                  // for % and Remaining only
pct   = tgt > 0 ? have / tgt : null   // progress (can exceed 100%)
raw   = tgt > 0 ? max(tgt - have, 0) : 0    // "Remaining"
left  = tgt > 0 ? max(tgt - proj, 0) : 0    // "N short by SvS day"
ok    = tgt > 0 ? proj >= tgt : null        // on track / behind
```

- **Bought packs are already inside Have** (members add what the packs gave them), so packs are never added again. This decision dates from 27 Sep; before that, packs were counted twice.
- `days()` = days from today to `settings.next_svs`. If the date is missing it assumes 30 (with a banner); if it has passed, 0 (with a banner).
- Everything downstream uses `calcItem`: the Backpack table, filter chips, the stats strip, the Dashboard, pack scoring and the matrix "Still short" row.

## Free income per day (measured)

- Every Backpack or pack-count save calls `noteSnapshot()`, which upserts one `stock_history` row per member per day (later saves the same day replace it): `have` = {item: Have} (raw Have, **not** including exchanges), `packs` = {pack_id: bought}.
- `recomputeFree()`: for each item, from its first snapshot to its latest within the last 90 days (`FREE_WINDOW_DAYS`):
  `rate = Σ max(0, rise in Have between consecutive snapshots − items delivered by packs bought in that step) / days`. Only rises count, so spending never cancels earned income (changed 2 Oct 2026; before, it was first-vs-last snapshot, which dropped to 0 after spending).
  Pack deliveries use **today's** `pack_contents` × the change in pack counts, so correcting a pack's contents later applies to both ends of the window alike.
- An item needs at least 3 days of span (`FREE_MIN_DAYS`). Before that, `freeRate` falls back to `user_items.free` (shown faded, "starting estimate").
- `renderFreeNote()` explains the measuring state above the Backpack table.

## Backpack (`renderStock`)

- Grouped by `grp`, with foldable headers (a fill bar shows how many items have Have > 0).
- Columns: icon, item, Have (input), Target (input), Remaining, Progress (bar + %), Free/day, Projected, Status pill (on track / behind / no target) and "N short by SvS day".
- Filter chips: All / Behind / On track / No target (`data-state`), plus search.
- **Planned exchange rows** (`tr.xch`) sit under each "to" item, one per exchange in `EXCH`:

  | id | Give → Receive | give:get | Max per week (quantity given) |
  |---|---|---|---|
  | charm-g2d | Charm Guides → Charm Designs | 2:1 | — |
  | charm-d2g | Charm Designs → Charm Guides | 2:1 | — |
  | plans-amber | Design Plans → Lunar Amber | 10:1 | 500 |
  | plans-polish | Design Plans → Polishing Solution | 1:3 | 500 |
  | alloy-polish | Hardened Alloy → Polishing Solution | 200:1 | 500 |
  | plans-alloy | Design Plans → Hardened Alloy | 1:300 | 500 |
  | polish-alloy | Polishing Solution → Hardened Alloy | 1:50 | 1,000 |
  | polish-plans | Polishing Solution → Design Plans | 10:1 | 50 |
  | alloy-plans | Hardened Alloy → Design Plans | 1000:1 | 50 |

  - The member types the number of "from" items they plan to give. `exchQty` caps it at `limit` (input `max`, plus a toast if they type more). `exchLots = floor(qty / give)`: received = lots × get, given = lots × give.
  - `exchDelta(name)` = Σ received where `to == name` − Σ given where `from == name`, over all exchanges. An item used in several exchanges (Design Plans feeds three) gets all of them.
  - Row text: `Exchange [from-icon] [input] » [to-icon] +N   give:get · Max L/week · <from> −given   [Reset]`.
  - Notes: a red warning when the total given of an item exceeds its Have + free income; an odd-leftover note; otherwise, once filled, "Planned, not yet traded. Reset it once you have traded in game and updated Have." **If a member updates Have after trading but keeps the entry, the trade is counted twice.**
  - Saved per member in `user_exchanges` (upsert on `user_id, xid`). `loadExch()` fails silently.
  - Not included: Charm Secrets (the 40:1 charm exchanges), because it is not a tracker item.
  - **Pending question**: does the in-game weekly limit cap the quantity given or the quantity received? The code assumes **given**.

## Things to buy (`renderPacks`)

- Default view is grouped by pack section (`sec`) and group (`grp`), each foldable. Clicking a sortable header switches to a flat sort (name, price, bought, pack value, best item, verdict); "✕ Reset sort" goes back to grouped.
- Columns: icon, name (+ occurrence), price (× the member's currency rate), **Bought** (input = packs already bought), best item for you, pack value bar, best-item bar, verdict pill.
- **Scoring (`calcPack`)**:
  - For each item in the pack (except Gems) that the member still needs (`raw > 0`) and that has a `baselines.usd`: `value = qty × usd / price`. The best one is `best` and `iv = best value × 100` (%).
  - `pv` = `packs.pack_value` (from Torxim).
  - Verdict: if nothing is scoreable, `pv ≥ 150` → Must buy, ≥ 100 → Worth checking, > 0 → Last resort. Otherwise `iv ≤ 0` → "—"; `pv ≥ 150 && iv ≥ 120` → **Must buy**; `iv ≥ 120` → **Item buy**; `pv ≥ 150` → Worth checking; else Last resort.
- Chips: All / Must buy / Worth checking / Bought (n).
- Moonlight Festival packs are "Event pack" (not scored; bought count limited, see `bind()`).

## Pack contents (`renderMatrix`)

Pack × item grid of quantities, with a first "Still short" row (`raw` per item). Columns are the items that have a baseline, plus any Moonlight item.

## Backpack export

- The **Export** chip in the Backpack toolbar opens `#export`, a full-screen dialog holding one canvas. `xpItems()` takes every item with a target (via `calcItem`): `met` when Have ≥ Target, `behind` when not met and the projection falls short. "Behind only" keeps just those.
- `xpRender()` sizes the canvas to the screen shape (1080 px wide, aspect clamped 0.6 to 2.4), then picks the fewest columns (3 to 16) whose rows fit the height, so cards are as large as possible and all show without scrolling. Each card: game icon (`ITEM_ART`, emoji fallback), Have (green when met, red otherwise), Target. Numbers from 100,000 are shortened (`123.5k`).
- Save downloads the PNG, Copy uses the async clipboard (needs HTTPS and a supporting browser), Share appears only where `navigator.canShare` accepts files. The status line is inside the dialog because the toast sits below the top layer.

## Dashboard

- **Stats strip (`renderTop`)**: Targets met (met/with targets, behind count), Average progress (capped per item at 100%), Spent so far (Σ price × bought, in the member's currency), Packs bought (count, and how many packs are "Must buy"), Days to next SvS.
- **Cards (`renderDash`)**:
  - Closest to target: top 5 open items by %.
  - Furthest behind: the bottom 5 of the rest. Ties at 0% are ordered arbitrarily (known).
  - Biggest gaps by value: raw × baseline USD.
  - Best buys for you: top 5 packs by `iv`.
  - Met targets drop out of both rankings.

## Languages (English, Spanish, Turkish, Norwegian)

- A language menu sits at the top of the hero and in the footer. The choice is kept in `localStorage['fox-lang']`; on a first visit the browser language decides (es, tr, nb/nn/no, otherwise English). Nothing is stored in Supabase.
- `i18n.js` never touches `app.js`. It walks the page, and for each text node and each `placeholder`, `title`, `aria-label`, `alt` and `data-label` attribute it looks the English text up in `i18n-data.js` (`window.I18N_ROWS`, one row per text: English, Spanish, Turkish, Norwegian). A MutationObserver translates whatever the app renders later. The English original is remembered, so switching back is exact.
- Matching is on the exact English text with whitespace collapsed. Numbers in a text are written `{n}` and a month after a day is `{m}` (for example `{n} {m}` for 5 Oct); keep them in the same order in every language. A text with no row stays English, so a partly translated page is always safe.
- Left in English on purpose: item names, building names, gear piece names and other in-game terms (the site joins data by item name), names and demo data, and a few help paragraphs whose sentence is split across inline tags.
- CSS-generated text cannot be translated by the observer: the phone labels come from `data-label` attributes (handled), and the Chief Charms "Upgrade cost" label has per-language overrides at the end of `style.css`.
- Norwegian is Bokmål (`<html lang="nb">`). The translations were drafted by Claude and still need a read-through by native speakers.
- **When you add member-visible text**, add a row to `i18n-data.js` (es, tr, no). Prefer wording that works for 1 and for many (`pieces: {n}`) over a plural form.

## Reference tab

Next SvS date and MUR rate (read-only), **My name** (edits the auth metadata name and the profiles copy), **My password** (see Auth), **My currency** (presets or a custom symbol and rate, saved to the profile), and the baseline value list.

## R4 roles

- `r4_members` (names) × `r4_tasks` (grouped into fixed `R4_SECTIONS` in order, then any other section). Each cell is the member's role for the task.
- **View**: ✓ orange = Main, ✓ grey = Assist. Each task row also shows "Main …, Assist …", its frequency and remarks, and its UTC time with the viewer's local time below. Search covers task names and people.
- **Workload cards** (`#r4-load`, under the table): one card per R4 with Leads N and Backs up M. Tapping a card sets the search to that name (and scrolls up); tapping it again clears it.
- **Edit roles** button (visible to `R4ED`):
  - R4 editor (`profiles.r4_editor`): may only cycle tick boxes, none → Main → Assist → none. Each change is saved by `set_r4_role` for that single cell (concurrent edits on different cells do not collide).
  - Admin: the same, plus inline text inputs (name, frequency, remarks, UTC time), Add task per section, × remove task (confirm), ▲▼ move within a section (`r4Move`: swap, then renumber the section's `sort` from its lowest value, saving only the rows that changed), and a "Manage the R4 list" card (rename, remove with confirm, add).
  - Table classes: `.adm` = tick editing (chips on phones), `.full` = admin editing.

## Members (admin only)

- Lists every profile: name (+ admin pill), signed up, last seen ("just now", "1 week ago", …), status pill (active today / this week / quiet / gone quiet), and an **R4 editor** toggle chip (not on admin rows) that calls `set_r4_editor`.
- **No emails are fetched or shown.** Search is by name. A nameless member shows as "Unnamed member".
- The database refuses the list to non-admins (RLS), whether or not they find the tab.

## Auth

- Sign in, create account (in-game name, email, password ≥ 8), sign out. Signup confirmation is off (`mailer_autoconfirm`).
- **Forgot your password?** calls `resetPasswordForEmail(email, {redirectTo: origin + pathname})`, with a neutral message ("If … has an account, a reset link is on its way. Check your spam folder too.").
- **Return from the email link**: `boot()` reads `#…type=recovery` before the client clears the hash, sets `SKIP_NEWS`, loads the app, then `openPasswordBox()` (opens Reference, focuses `#newpw`, shows "Choose a new password to finish resetting it.").
- `#error_description=…` (for example an expired link) shows on the sign-in screen.
- **My password** (`#newpw`, `#pw-save`, Enter works): `SB.auth.updateUser({password})`, minimum 8 characters.
- Email delivery itself depends on Supabase SMTP and URL configuration: **not verified** (see open items).

## What's new

- `UPDATES` (newest first) holds `{id, date, title, points[]}`. On load, if the newest id differs from `localStorage['fox-news-seen']`, a modal lists the unseen entries. Closing it marks the newest as seen. The footer link "What's new on the tracker" reopens the full list.
- Current newest ids: `2026-10-02-freeincome`, `2026-10-02-r4load`, `2026-09-29-exchmax`, `2026-09-28-exchange2`, `2026-09-28-password`, `2026-09-28-r4order`, `2026-09-28-ticks`, `2026-09-28-r4ed`, …
- Write entries for members: plain English, what changed and what to do, two or three bullet points at most.

## Other behaviour

- Saving status shows in `#sync` and as toasts ("saving…", "saved", "Not saved — check your connection…").
- Folded groups are remembered in localStorage (the `FOLD` and `PACK_FOLD` keys).
- Headroom: on phones the header slides away when scrolling down past 90px, and comes back on any upward scroll of more than 5px.
