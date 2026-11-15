// Private questionnaire lookup. Existing alliance sync is deliberately independent.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { createHandler } from './handler.mjs';

Deno.serve(createHandler({
  getKey: () => Deno.env.get('WOS_API_KEY'),
  client: (authorization: string) => createClient(
    Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } },
  ),
}));
