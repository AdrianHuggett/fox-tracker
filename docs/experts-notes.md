# Experts planner: extraction notes

- Source: https://wostools.net/experts-calculator, retrieved 2026-10-06. Catalogue in chunk `5867-189e42f88fb90140.js`, webpack module `65867` (self-contained, no dependencies). Bundle names change with every WoSTools build.
- Extracted by running only that module in the WoSTools page with a stub `require.d`, then normalised to `experts-data.js` (`window.EXPERTS_DATA`). The published file was compared character for character with the extraction (23,126 characters, identical).
- Export meanings: `Of` all 10 Experts, `o4` affinity gifts, `Xn` affinity cost, `hA` sigil cost, `rR` books, `KS` learning minutes, `Er` skill cap at a relationship level, `aN` skill unlock level, `F1` relationship level options.

## Rules (as implemented in `experts.js`)

- Relationship 0 to 100. A multiple of 10 is first reached (stored as x − 0.5, shown "Lv. x") and then advanced (x, "Lv. x · Advanced").
- Affinity from a to b = sum of `affinityCosts[ceil(a) .. ceil(b) − 1]` (index i = level i to i+1). Advancing costs no affinity.
- Sigils from a to b = sum of `sigilCosts[x/10 − 1]` for every multiple of 10 with a < x ≤ b.
- Skill books / minutes from level a to b = sum of `bookCosts` / `minutes` over indexes a .. min(maxLevel, b) − 1.
- Skill i (non-talent, 1-based) unlocks at relationship 10 × i. Above that, `caps` gives the highest level allowed from a relationship level (relationship floored to 10); outside the listed range the cap is `maxLevel`. Talents auto-upgrade and cost nothing.
- SvS points: 6,000 per sigil, 60 per book, 30 per learning-speedup minute. FOX shows sigils and books only, like the other planners.

## Backpack targets (rule chosen by Adrian, 2026-10-06)

- Books of Knowledge: total books of the plan.
- Each Expert's own sigil item (`Ciryl Sigils` for Cyrille, `Agnes Sigils`, …, `Gareth Sigils`): total sigils that Expert needs.
- General Expert Sigils: Σ max(0, Expert sigils − Have of that Expert's own sigils). The only target that depends on stock, because the game spends own sigils first.
- A material whose item is not in the member's Backpack is left out of the push and named in the summary.

## Reference checks (WoSTools UI and catalogue agree)

| Case | Result |
|---|---|
| Cyrille relationship 0 → 100 Advanced | 171,690 Affinity, 275 sigils |
| Cyrille 0 → Lv. 10 (not advanced) / Lv. 10 → Advanced | 3,260 Affinity / 5 sigils |
| Romulus 0 → 100 | 939,960 Affinity, 1,820 sigils |
| Agnes 23 → 41 | 17,670 Affinity, 35 sigils |
| Cyrille Entrapment 0 → 10 | 3,150 books, 2,700 min (45 h) |
| Cyrille Scavenging 2 → 4 | 2,400 books, 2,760 min |
| Entrapment cap at relationship 25 / 5 | 4 / 0 |

## Open points

- Ronne and Kathy are flagged `estimated` in the source.
- Fabian · Crisis Rescue lists 551 minutes for level 1 → 2, where the series suggests 895. Kept as in the source.
- Gareth Sigils has no artwork and may be missing from older Backpacks.
