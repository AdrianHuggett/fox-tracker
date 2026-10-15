# Widgets planner

The standalone Widgets planner covers the 16 mythic heroes from Gen 1–5 that have individual widget rows in Backpack:

| Generation | Heroes |
| --- | --- |
| 1 | Natalia, Jeronimo, Molly, Zinman |
| 2 | Flint, Philly, Alonso |
| 3 | Logan, Mia, Greg |
| 4 | Ahmose, Reina, Lynn |
| 5 | Hector, Norah, Gwen |

The planner level range is 0–10. Cumulative Widgets from level 0 are `0, 5, 15, 30, 50, 75, 105, 140, 180, 225, 275`. A planned upgrade costs `cumulative[target] - cumulative[current]`. SvS points use 8,000 points per Widget. Source: [WoSTools Hero Gear calculator](https://wostools.net/hero-gear-calculator), checked 15 October 2026.

Plans are stored in Supabase Auth user metadata under `fox_widget_plan`. The Backpack bridge maps each hero to the existing item named `<Hero> widget`. Pushing targets changes only heroes with a positive planned cost, setting each item's Target to that cost. Existing Have and targets for heroes without upgrades remain unchanged. The push is previewed in a confirmation dialog. Missing Backpack rows block the push before any database writes.
