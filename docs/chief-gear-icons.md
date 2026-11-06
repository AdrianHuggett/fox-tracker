# Chief Gear rank artwork

`chief-gear-icons.js` and `chief-gear-icons.css` render the same display rules in the public Chief Gear planner and the private account view. The account view renders the recorded current level; the planner renders both current and target levels. They do not change stored IDs, costs or bonuses.

Thirty clean game icons cover six pieces and five colours. Source: `images/chief-gear/` in the public `chiefpansancolt/whiteout-survival-data` GitHub repository, retrieved 7 November 2026. Local files are under `chief-gear-art/`. The base artwork contains no baked stars, tiers or lock overlays.

Rank badges come from the selected stage, with stars stacked vertically and T1–T4 in the top corner. Partial progress uses the catalogue's real denominator, including five-part stages. Unknown and unequipped remain distinct. Public planner labels include the T tier even where legacy catalogue labels omitted it.

The private document embeds the shared renderer and CSS. Its images are embedded as a compact sprite inside the document, preserving the existing data-only image policy and opaque sandbox. Private profile data and the document remain outside the public repository.

Checks: `tools/test_gear_icons.py` covers saved/edit views, both screen widths, the actual artwork, rank badges, partial stages, unchanged saved IDs and absence of unintended Backpack writes. The existing smoke suite also opens Chief Gear.
