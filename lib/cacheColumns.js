// Prompt-cache columns on app_events (supabase-migration-v4-cache-tokens.sql).
//
// The dashboard asks for them only once they exist: selecting a missing column
// fails the whole query, and the overview would then show no Craft usage at
// all. Once found they are remembered for the life of the server instance;
// while missing they are checked again on each request (one tiny query).

let known = null;

/** ',cache_read_tokens,cache_write_tokens' when app_events has them, '' otherwise. */
export async function appEventCacheColumns(supabase) {
  if (known !== null) return known;
  const { error } = await supabase.from('app_events').select('cache_read_tokens,cache_write_tokens').limit(1);
  const cols = error ? '' : ',cache_read_tokens,cache_write_tokens';
  if (!error) known = cols;
  return cols;
}
