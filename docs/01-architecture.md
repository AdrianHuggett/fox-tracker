# 01 · Architecture

## Files in the repo

| File | Role |
|---|---|
| `index.html` | All markup: header and tabs, auth card, one `<section class="panel" id="p-…">` per tab, the What's-new modal and the footer. Defines `window.CONFIG = {url, key}` (the public Supabase URL and anon key). Loads Google Fonts, Supabase JS v2.45.4 (jsDelivr UMD), `style.css?v=TAG` and `app.js?v=TAG`. |
| `app.js` | The whole app in one IIFE (`(function(){ 'use strict'; … })()`). ES5 style (`var`, `function`), plus `async/await` and `Promise.all`. No modules, no framework. |
| `style.css` | Theme variables, desktop table layout, then phone/tablet layouts in `@media (max-width:820px)` blocks. |
| `item-*.png` | 38 item icons (24px display). Mapped in `ITEM_ART`; items without art fall back to `it.icon` (an emoji or text). |
| `art-hero.jpg`, `art-footer.jpg`, `art-fox.png` | Hero banner, footer art, logo. |
| `experts.js`, `experts-data.js`, `experts.css` | Dawn Academy Experts planner (`FOXExperts.mount`, bridge `mountExperts()` in `app.js`, plan saved as `fox_expert_plan` in the account metadata). Extraction and rules: `docs/experts-notes.md`. |
| `i18n.js`, `i18n-data.js` | Language switcher: the engine, and one row per English text with its Spanish, Turkish and Norwegian translation (see "Languages" in `03-features.md`). |
| `moonlight-festival.js` | **Dead**: not loaded anywhere. Safe to delete (ask first, as housekeeping). |
| `.gitattributes` | `* text=auto eol=lf`. GitHub's web editor used to reintroduce CRLF; keep LF. |
| `README.md` | Title only. |

## Tabs (`nav.tabs button[data-p]` → `section#p-<p>`)

| `data-p` | Label | Rendered by |
|---|---|---|
| `dash` | Dashboard | `renderTop()` (stats strip) + `renderDash()` (4 cards) |
| `stock` | Backpack | `renderStock()` (+ `exchRow()` rows) |
| `packs` | Things to buy | `renderPacks()` |
| `matrix` | Pack contents | `renderMatrix()` |
| `ref` | Reference | `renderRef()` + static cards: SvS date, MUR, My name, **My password**, My currency, baselines |
| `r4` | R4 roles | `renderR4()` (loaded lazily by `loadR4()` on first open) |
| `admin` | Members (hidden unless admin) | `renderMembers()` (loaded by `loadMembers()`) |

A tab click toggles `.panel.on` and stores the tab in `sessionStorage['fox-tab']`. `restoreTab()` reopens it **only on a reload**; a fresh arrival always shows the Dashboard (`isReload()` uses the Navigation Timing type).

## `app.js` code map (in file order)

**Globals** (top of file): `SB` (Supabase client), `U` (auth user), `ADMIN`, `R4ED` (admin or R4 editor), `membersLoaded`, `D = {items, packs, contents, base, settings}`, `uPacks` (pack_id → bought count), `sortMode`/`sortDir` (packs table), `PACK_FOLD` and `FOLD` (folded groups, kept in localStorage), `HIST`, `HIST_OK`, `FREE_M`, `HIST_SPAN`, `HIST_SINCE`, `FREE_MIN_DAYS = 3`, `FREE_WINDOW_DAYS = 90`, `CURR` (currency presets), `CUR` (the member's currency), `ICO` (inline SVG icons).

**Helpers**: `initials()`, `identifyUser(u)` (sets `U`, header email and avatar), `money()`, `baseMoney(usd)`, `fillCurrencyInputs()`, `saveCurrency()`, `toast()`, `say(text, warn)` (status line + toast), `fatal(title, why)`, `n(v)` (safe number), `fmt(v, dp)` (en-GB number format), `esc(s)` (HTML escape; **use it on all user or DB text**), `$(id)`.

**Maths**: `moonlightPack(p)`, `svsInfo()` / `days()` (days to `settings.next_svs`; 30 if it is missing; 0 if it is past), `renderSvsWarn()`.

**Planned exchanges**: `EXCH` (config), `EXQ` (entries), `exchQty()`, `exchLots()`, `exchGiven()`, `exchDelta()`, `loadExch()`, `saveExch()`, `exchRow()`, plus a document-level `change` handler for `#stock input.xin` and a `click` handler for `#stock button.xreset`.

**Core calculations**: `calcItem(it)` → `{have, tgt, proj, pct, raw, left, ok}`, `itemMap()`, `calcPack(p, byName)` → `{best, iv, pv, verdict, scoreable}`, `budget()`.

**Measured free income**: `todayKey()`, `dayNum()`, `prettyDay()`, `packCounts()`, `packsDelivered()`, `currentSnapshot()`, `trimHistory()`, `recomputeFree()`, `freeRate(it)`, `freeCell(it)`, `renderFreeNote()`, `noteSnapshot()`, `loadHistory()`.

**R4 roles**: `R4 = {members, tasks, loaded, loading}`, `R4_EDIT`, `R4_SECTIONS` (fixed section order), `R4_TONE`, `r4Task()`, `r4Name()`, `r4Msg()`, `r4Local()` (UTC to local time), `r4Sections()`, `r4Who()`, `r4In()`, **`renderR4()`**, `loadR4()`, `r4Refocus()`, `r4Cycle()` (via the `set_r4_role` RPC), `r4Field()`, `r4AddTask()`, `r4Move()`, `r4DelTask()`, `r4AddMember()`, `r4DelMember()`, `r4Rename()`, plus delegated click/change/keydown handlers (including the `#r4-load` workload cards).

**What's new**: `UPDATES`, `NEWS_KEY = 'fox-news-seen'`, `newsHtml()`, `markNewsSeen()`, `openNews()`, `closeNews()`, `SKIP_NEWS`, `maybeShowNews()`, `wireNews()`.

**Saving**: `pcolor()`, `queue(key, fn)` (500 ms debounce per key; `fn` returns a Supabase promise; reports through `say`), `saveItem(it, field)`, `savePack(id, freq)` (both also call `noteSnapshot()`).

**Rendering**: `ITEM_ART`, `itemIcon()`, `inp()`, `renderStock()`, `packRank()`, `renderPacks()`, `renderMatrix()`, `renderRef()`.

**Members**: `plural()`, `fmtDate()`, `ago()`, `TONE`, `MEMBERS`, `renderMembers()`, `membersMsg()`, a click handler for `[data-r4ed]`, `loadMembers(force)`, `dispMsg()`, `saveDisplayName()`, `touchProfile()` (stamps email, name and last_seen), `checkAdmin()`.

**Dashboard**: `renderTop()`, `dbar()`, `dashRow()`, `renderDash()`.

**Backpack export**: `XP`, `xpItems()`, `xpNum()`, `xpArt()`, `xpRound()`, `xpText()`, `xpRender()` (draws the canvas), `xpBlob()`, `xpMsg()`, `openExport()`, `wireExport()`. Markup: `#export` dialog in `index.html`, styles at the end of `style.css`.

**Render loop**: `focusKey()`, **`render()`** (calls `renderSvsWarn, renderFreeNote, renderTop, renderDash, renderStock, renderPacks, renderMatrix, renderRef, applyFilters, bind`, then restores focus), `bind()` (wires `input.cell` fields: input/blur save, change re-renders).

**Filters and tabs**: `filters`, `queries`, `applyFilters()` (per table: chip filter via `data-state`, search via `data-q`, folding via `data-gn` / `data-psection` / `data-pgroup`; rows with class `grp`, `sec` or `need` are headers), then document handlers for search, tab clicks, chips, sort headers and folding.

**Auth and load**: `authMsg()`, `showAuth()`, `showApp()`, **`loadAll()`**, `isReload()`, `restoreTab()`.

**Headroom** (the phone header hides on scroll-down): `HR_REVEAL`, `HR_TOL`, `headroomShow()`, `headroomApply()`, `headroomScroll()`, `headroom()`.

**Password**: `pwMsg()`, `changePassword()`, `openPasswordBox()`.

**Boot**: **`boot()`** (reads the recovery or error hash, creates the client, calls `wireUp()`, `getSession()`, then `loadAll()` or `showAuth()`), **`wireUp()`** (sign in, sign up, forgot password, sign out, password box, currency inputs, auth tabs). The file ends with `headroom(); boot();`.

### Load sequence

`boot()` → `wireUp()` → `SB.auth.getSession()` → `identifyUser()` → `loadAll()`:

1. `Promise.all` loads settings, baselines, packs (ordered by sort), pack_contents, user_items (ordered by sort), user_packs, and the member's currency. Any error triggers `fatal()`.
2. Builds `D`. Items in a "Moonlight Festival" group are filtered out.
3. `fillCurrencyInputs()`, then `loadHistory()`, then `loadExch()`.
4. `touchProfile()` and `checkAdmin()` (not awaited).
5. `showApp()`, `render()`, `restoreTab()`, `maybeShowNews()`.

`checkAdmin()` resolves later. It sets `ADMIN` and `R4ED`, shows the Members tab, re-renders R4 if it is loaded, and loads Members if that panel is already open. This is the fix for "Members empty after a refresh".

## Rendering conventions

- Rows are built as HTML strings and assigned with `innerHTML`. Every interpolated value goes through `esc()`.
- Tables carry `data-state` (filter chips), `data-q` (lower-case search text) and `data-gn` (fold group) on each row.
- Inputs: `inp(val, cls, attrs)` builds `input.cell type=number`. `data-idx` + `data-k` point at `D.items[idx][k]`; `data-pid` points at a pack.
- Re-render after a `change` event, never on every keystroke (`bind()` saves on input, renders on change). `render()` restores focus through `focusKey()`.

## CSS and layout rules

- Theme variables are on `:root`. Fonts: Chakra Petch (labels and headings), IBM Plex Mono (numbers and emails), the system UI stack for body text.
- **Specificity trap**: ids beat classes, so state utilities like `tr.hide` use `!important`.
- **Phone (≤ 820px)**: `#stock` and `#packs` become CSS-grid cards using `nth-child` placement. Any extra row type in those tables (e.g. `tr.xch`) needs `display:block !important` overrides. `#r4` becomes three-line cards; in edit mode (`#r4.adm`) the tick boxes become labelled chips with the R4 name. `#members` uses grid areas `"nm st" "up seen"` and classes `up`/`seen`.
- Inputs on phones are 16px (iOS zoom). Touch targets are known to be small in places (accessibility debt).
- In the phone media queries, later rules with equal specificity win, so add new overrides after the rule they override.

## Identifiers you will meet

- Item names are the join key everywhere (`user_items.name`, `pack_contents.item`, `baselines.item`, `ITEM_ART`, `EXCH`). **Renaming an item breaks those links.**
- `profiles.id` = `auth.users.id`. R4 members (`r4_members.id`, bigint) are **not** user accounts; they are just names.
