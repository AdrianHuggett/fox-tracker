# Private profile lookup

The owner approved activation on 16 November 2026. The quota SQL and function were installed in the production project, with JWT verification enabled. The deployment procedure below is retained for reference; do not rerun the table creation on an existing installation.

1. Apply `supabase/private-profile-lookup.sql` once. It creates a separate quota table and an authenticated RPC. Only the admin owner of the `account-optimizer` private preview can claim a lookup. The table has no client access policies or grants.
2. Deploy `index.ts` and `handler.mjs` together as `wos-profile`, with JWT verification enabled. It uses the existing `WOS_API_KEY` secret and standard Supabase URL/anon environment variables. Never copy secret values into source or a browser. No service role credential is used by this function.
3. Release the public delivery bridge and the separately prepared private questionnaire document. The document SQL lives outside the public repository, under `outputs/account-optimizer-private/install-questionnaire.sql` in the parent workspace. It does not reset the saved profile or change existing preview permissions.
4. Verify the signed-in owner can find a real account, with its actual State. Verify another State returns a mismatch, another signed-in user cannot use this endpoint, and the private profile is not written until the user confirms the found identity.

POST body: `{ "stateId": "3685", "chiefId": "123456789" }` (example only).

The provider identifies the player by Chief ID; State is checked against the response. A successful lookup does not prove ownership of the game account. Requests are limited atomically to one per 30 seconds and 30 attempts per UTC day, per private owner. The existing alliance sync quota remains independent; provider-wide limits still apply. A failed upstream attempt also consumes one local attempt.

The response is a selected snapshot, retaining the provider's field names and source freshness. Missing data remains null/absent. Heroes are the Arena defence team only, never the full roster. No recommendation logic or saved player data is included in these public files. Actual hero/skill identifiers and chief gear details still need live response validation before a later questionnaire step uses them to generate advice.

Local verification: `node ../outputs/account-optimizer-private/test-questionnaire.cjs` from the repository. This covers the endpoint with synthetic responses, PostgreSQL quota permissions, the public bridge, and the private UI at desktop and phone widths. It is not evidence of a live API call.
