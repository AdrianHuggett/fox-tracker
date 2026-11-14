# Pack contents refresh — 14 November 2026

Applied to Supabase with explicit owner approval: 162 item-content corrections across 57 existing packs. Of 207 offers, 183 were matched to the current Torxim reference; 24 ambiguous variants were left unchanged. Existing IDs, GBP prices, purchase counts, Backpack Have and Target amounts, and stock history were preserved.

The reference remains FC5–Gen5: Torxim has no exact FC6 phase. Vault daily packs retain the previously selected 75-sigil FC8 variant. This refresh changes contents, not stored pack-value percentages. Corrected contents can affect free-income estimates and pack recommendations.

Random chests and selectable hero/expert rewards are kept as distinct items rather than converted into guaranteed general shards, Mythic Hero Gear, or Ronne Sigils. Pack speedups use hours; Backpack speedups use days. Chief Stamina uses the source quantity without conversion to Stamina Cans.

Sources: [scheduled packs](https://torxim.com/regularly-scheduled-packs), [triggered packs](https://torxim.com/triggered-packs), [pop-up packs](https://torxim.com/pop-up-packs), [weekly/monthly cards](https://torxim.com/weeklymonthlycards), [weekly/monthly deals](https://torxim.com/deals/weekly-benefits-card-intel-monthly-card), [recurring deals](https://torxim.com/deals/recurring-deals), [event packs](https://torxim.com/event-packs), [Moonlight Festival](https://torxim.com/special-events/moonlight-festival).

The guarded transaction checks pack identity, prices and prior quantities before changing `pack_contents`, then verifies the new quantities and preservation of unrelated records before committing. Local PGlite validation covered initial application, repeat application, rollback and rejection of unexpected data changes. Production returned `packs_verified = 57`, `content_changes_verified = 162` with all preservation checks passing.

Migration and reverse migration are stored in `tools/torxim-contents-2026-11-14.sql` and `tools/torxim-contents-2026-11-14-rollback.sql`. Any future execution still requires explicit approval.
