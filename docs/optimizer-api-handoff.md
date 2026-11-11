# WhiteoutStats profile import handoff

Prepared on 11 November 2026. Resume work on FOX's private "Optimise your profile" feature by importing available player data from the existing WhiteoutStats integration.

## Status and scope

Research and the implementation outline are complete. Hero import has not been implemented or deployed. Adrian wants to continue from another computer; this handoff records the agreed direction, not a completed feature or approval of a specific database migration.

- Repository: https://github.com/AdrianHuggett/fox-tracker
- Live site: https://adrianhuggett.github.io/fox-tracker/
- API documentation: https://api.whiteoutstats.com/
- Baseline inspected: `fcc7b9c` on `main`.
- Read `AGENTS.md`, `CLAUDE.md`, and the relevant project docs before changing anything. Speak French to Adrian; keep repository content and source UI text in English.

## Existing integration

WhiteoutStats already supplies alliance rosters, player power, furnace levels and map positions. These support Layout planner and Fortress rewards.

| File | Purpose |
| --- | --- |
| `supabase/functions/wos-sync/index.ts` | Server-side API requests, scheduled roster/position sync and admin/R4 on-demand alliance sync |
| `supabase/wos-sync.sql` | Existing player cache and scheduling setup; do not rerun blindly |
| `app.js` | `FOXGameData` reads cached players and requests alliance sync |
| `private-preview.js` | Private optimizer delivery and profile save bridge |
| `docs/01-architecture.md` | Private profile delivery architecture |
| `docs/02-database.md` | Database, permissions and sync documentation |
| `docs/04-workflow.md` | Validation and release requirements |
| `docs/05-history.md` | Existing WhiteoutStats integration history |

The optimizer document, recommendation rules and saved profile are private and are not public repository assets. `private-preview.js` loads the authorized document/profile and saves through the existing revision guard. Locate the current private implementation through authorized access before choosing a mapping. Do not copy its document, rules or player profile into this public repository.

The API credential is an existing server-side function secret. Never read, print, commit or expose its value to the browser. Preserve current Layout planner and Fortress rewards behavior.

## Documented API capabilities and limitations

The public API documentation inspected on 11 November 2026 describes:

```http
GET /v1/players/{chief_id}?include=base,heroes,ranks,chief_gear
```

The default identifier is the in-game Chief ID. Internal `uid` is different and requires `id_type=uid`.

- `heroes`: hero ID/name, level, stars, skill IDs and levels, equipped helmet/gloves/armor/boots, enhancement and mastery forging levels, and exclusive weapon/widget details.
- `chief_gear`: chief equipment when visible; hidden equipment is explicitly marked and may have an empty item list.
- Response metadata includes freshness and cache timing.

**The heroes section contains the arena defence team, not the player's entire hero collection.** Absence from an import must never mean a hero is not owned.

These capabilities were checked in the documentation, not yet validated against an authenticated response for the new import. Inspect an authorized response through the server integration before implementing the final field mapping. Verify where sections occur in the response, star encoding, skill IDs, equipment slots, null values, and Exploration versus Expedition skills. Do not infer unsupported data from power alone.

Responses can be cached. Display actual freshness metadata rather than treating request time as observation time. Recheck current API limits and behavior before implementation.

## Intended player workflow

1. Associate the FOX profile with the player's Chief ID. Treat this as an association, not proof of game-account ownership.
2. Add an `Import from game` action using the server integration.
3. Show the retrieved player identity and import changes, then populate compatible fields.
4. Let the player complete missing heroes and details manually.
5. Preserve manual additions and corrections when refreshing imported data.
6. Show data provenance and last successful observation/import times.

Use stable hero IDs and an explicit mapping to the private optimizer's schema. Distinguish unknown values from zero. Track imported values separately enough to resolve conflicts with manual corrections. Do not delete existing profile data on omitted sections, hidden equipment, an empty/partial response, timeout, unknown player or rate limiting. Preserve the existing profile revision/conflict protection.

## Implementation sequence

1. Check the home checkout's status, then synchronize Git without overwriting local work. Locate the current private optimizer and inspect its schema through authorized access.
2. Prepare a field mapping and an import merge policy. Identify which available inputs are useful to the optimizer and which remain manual.
3. Design the smallest server-side extension or dedicated import path using the existing credential setup. The current on-demand alliance sync is restricted to admins/R4; do not simply broaden that route to all members. Define authenticated personal-import permissions, quota limits and cache behavior separately.
4. Prepare any backend/storage changes for concrete review. Follow the repository's Supabase rules: explain the exact changes and obtain Adrian's explicit approval before applying them; Adrian performs dashboard changes. Do not request secrets.
5. Implement and test normalization/merge logic with synthetic fixtures. Keep actual private profile data out of public test files.
6. Wire the private profile UI to the authorized import path, preserving existing manual editing and save behavior.
7. Validate desktop/mobile behavior and follow `docs/04-workflow.md`. Apply cache, translation and What's new requirements according to whether the release changes public/member-visible assets or only the private preview. Verify the actual released version before claiming publication.

## Acceptance checks

- Correct identity and stable hero/skill/equipment mapping.
- Partial arena roster does not erase other saved heroes.
- Explicit zero remains distinct from absent/unknown.
- Repeating the same import does not duplicate heroes or overwrite manual corrections silently.
- Hidden equipment and missing sections preserve existing values with a clear status.
- Invalid IDs, API errors, timeouts and quota exhaustion leave the saved profile intact.
- No key is sent to the browser; access and quota rules are enforced server-side.
- Existing alliance/position sync and Fortress rewards continue to work.
- Private profile saves retain revision/conflict handling.

## Lessons for future lineup recommendations

Reference reviewed: https://state3685.fun/winter-siege/

Useful ideas: event-specific recommendations, two complementary squads without duplicate heroes when required, alternatives, explanations, and visible missing-data limitations. Reuse the player's profile instead of asking them to recreate their roster. Distinguish the strongest available setup now from future upgrade priorities.

The reference engine is advisory, not a battle simulator. It tests preset troop ratios, scores hero development and semantic skill coverage, and favors a stronger second squad. It does not model full numerical troop/equipment/opponent combat statistics. Do not reuse its weights as validated combat optimization. The inspected version also has an inconsistency where explicit maximum skill levels can score below the "Near maxed" estimate; add monotonicity checks to any future FOX scoring model.

Suggested result structure: recommended lineup, troop ratio, reasons, alternative, next improvement, and missing inputs. These are future recommendations, not claims about features already present in FOX's private optimizer.

## Local work to preserve

At handoff, `news-alliance.png` and `news-world.png` were unrelated untracked files. Do not add, remove or overwrite them as part of this work. Recheck the destination machine's actual worktree rather than assuming it has the same state.
