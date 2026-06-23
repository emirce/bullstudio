export type SearchableQueue = { name: string; prefix?: string };

/**
 * Case-insensitive substring match of `query` against a queue's name or prefix.
 * An empty/whitespace query matches everything (no filter applied).
 *
 * @param queue - Queue to test (its `name` and optional `prefix`).
 * @param query - Raw search term as typed by the user.
 * @returns Whether the queue should be shown for this query.
 */
export function queueMatchesQuery(
  queue: SearchableQueue,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    queue.name.toLowerCase().includes(q) ||
    (queue.prefix?.toLowerCase().includes(q) ?? false)
  );
}
