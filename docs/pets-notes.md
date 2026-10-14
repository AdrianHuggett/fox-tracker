# Pets planner: source, rules, and limits

Source: https://wostools.net/pets-calculator, captured 14 Oct 2026.

The public WoSTools chunk `7299-79c0e6b399381eb4.js`, module `17299`, has SHA-256 `40e58533ceb3ac89ae9b8376c72a77c1a96e029a9e9476c54344fdfc219d65ed`. The self-contained catalogue exposes 14 pets, 5 rarities, food costs for each level transition, advancement materials and scores, prerequisite pets, refinement costs, and troop attack/defence rates. `pets-data.js` contains selected data in named fields. FOX never fetches WoSTools during use.

## Level convention

At each tenth level, WoSTools offers both `Lv. N` (stored as `N − 0.5`, not advanced) and `Lv. N · Advanced` (stored as `N`). Food costs cover level transitions using ceiling values; advancement costs are charged only when an advancement threshold is crossed. All costs are summed across the selected current and target level for each pet. Values are cumulative for the plan, with no subtraction of Backpack stock.

Examples checked directly against the extracted WoSTools functions:

| Pet and range | Food | Manuals | Potions | Serums | Advancement score |
|---|---:|---:|---:|---:|---:|
| Cave Hyena 1 → Lv. 10 | 1,715 | 0 | 0 | 0 | 0 |
| Cave Hyena Lv. 10 → Advanced | 0 | 15 | 0 | 0 | 500 |
| Cave Hyena 1 → Advanced Lv. 10 | 1,715 | 15 | 0 | 0 | 500 |
| Cave Lion 1 → Advanced Lv. 30 | 42,275 | 215 | 15 | 0 | 3,500 |

SvS points = advancement score × 50 + Common Wild Marks planned to spend × 1,150 + Advanced Wild Marks planned to spend × 15,000. FOX shows base material points only. Event bonuses, food, and unopened chests contribute no points. WoSTools also has an upgrade suggestion optimizer; FOX does not yet reproduce that optimizer.

## Backpack and persistence

The planner reads Pet Food, Taming Manuals, Energizing Potions, Strengthening Serum, Common Wild Marks, and Advanced Wild Marks from `user_items` by exact name. Its Push dialog sets Target to the **full planned amount** for materials with a positive amount; Have is unchanged. All requested items must exist before any update begins. Partial network failures are reported. Plans are saved as `fox_pet_plan` in Supabase user metadata. No database schema changes are required.

Custom Chests are entered manually in the planner because there is no matching Backpack item. Each may supply 7 Manuals, 2 Potions, or 1 Serum; the planner does not automatically allocate them or deduct them from targets. Unlock prerequisites are shown as warnings and are not automatically added to the plan. Pet specific refinement tier planning and combat recommendations are outside this version; Wild Marks can be entered as planned spend for point and target calculations.
