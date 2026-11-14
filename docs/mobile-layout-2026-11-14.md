# Phone layout audit — 14 November 2026

## Changes

- Pets: constrain the plan's intrinsic grid width, keep rarity tabs in their own horizontal scroller, and stack costs below the selected levels on phones. Edit and Save remain reachable.
- Chief Gear: use 44 px phone artwork, preserve tier/star badges, give target selectors their own space, and stack selectors below 381 px. Saved rows no longer indent their comparison and costs by 64 px.
- Hero Gear: use 52 px phone artwork with proportionate overlays; allow headings and cost breakdowns to wrap.
- Navigation: reserve the subnavigation's height and place the language selector in normal flow on phones, preventing collisions with the hero heading.
- Fortress: wrap sort button labels inside the available width.

These are presentation changes. Saved plans, calculations, Backpack records and database permissions are unchanged.

## Verification

Independent visual and computed-geometry assessments preceded implementation. The final review confirmed Pets overflow (453 px intrinsic page width), truncated Chief Gear target selectors, clipped Fortress sorting, and the language/title collision. Oversized or mutually overlapping gear tiles were not reproduced in the local source; smaller tiles are a requested usability improvement rather than a claimed diagnosis of every reported overlap.

- Offline Chrome audit: 125 rendered states across 320, 360, 390, 430 and 1150 CSS pixels, covering the main navigation, all upgrade planners, resources and alliance pages. Populated editing and saved states were included for Chief Gear, Hero Gear and Pets.
- Post-fix geometry: no document overflow, clipped controls or painted control overlaps in those states; no JavaScript errors.
- Additional occupied/high-tier equipment check: 14 states at 320 and 390 px, including Purple 1-star to Red T4 3-star plans; no geometry failures.
- Existing functional smoke suite passed at desktop 1150 px and phone 400 px, including plan persistence, target handling and alliance interactions.
- Shared styling and layout checked visually in final Pets and Chief Gear screenshots. Intentional horizontal navigation, matrix tables and map surfaces retain their scroll behavior.

## Limits

Chrome viewport emulation is not physical iOS/Safari testing. Offline fixtures omit remote fonts and cannot supply the private profile; the connected account's private profile was inspected separately, read-only. Deep interaction with every embedded-map control and every error state was not exhaustively audited. Raw offscreen geometry inside a closed disclosure or a scrollable table was excluded from overlap defects.
