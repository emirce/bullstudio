import { type RedisConnection, scanMatching } from "../utils";

/**
 * Discover all Bull/BullMQ prefixes in a Redis instance
 * by scanning for known key patterns:
 *   - BullMQ: `<prefix>:<queue>:meta`
 *   - Bull:   `<prefix>:<queue>:id`
 *
 * @param redis - Redis client to scan (fans out across cluster masters).
 * @returns Every distinct prefix found, sorted alphabetically.
 */
export async function discoverPrefixes(
  redis: RedisConnection,
): Promise<string[]> {
  const prefixes = new Set<string>();
  // Strip the trailing `:<queue>:<suffix>` to recover the full prefix, which
  // may itself contain colons (e.g. a Redis Cluster hash tag like
  // `local:{event}` or a tenant prefix like `tenant:bull`). Assumes a
  // single-segment queue name, matching the `*:*:meta` / `*:*:id` scan shape.
  const prefixOf = (key: string) => {
    const parts = key.split(":");
    if (parts.length < 3) return null;
    return parts.slice(0, -2).join(":") || null;
  };

  await collectPrefixes(redis, "*:*:meta", prefixOf, prefixes);
  await collectPrefixes(redis, "*:*:id", prefixOf, prefixes);

  return Array.from(prefixes).sort();
}

/**
 * Resolve the prefixes configured via `REDIS_PREFIX` into the concrete prefixes
 * to query. Each configured entry is treated as:
 *   - `"*"`            → every prefix in the instance (full discovery)
 *   - a glob pattern   → e.g. `local:{*}` expands to `local:{event}`,
 *                        `local:{open-search}`, … (every concrete prefix the
 *                        pattern matches). `*` matches within a key segment.
 *   - a literal prefix → used verbatim.
 *
 * Falls back to `defaultPrefix` when nothing is configured or nothing matches.
 *
 * @param redis - Redis client used to expand `*` and glob patterns.
 * @param configured - Configured prefix entries (literals, globs, or `"*"`); `undefined`/empty falls back.
 * @param defaultPrefix - Prefix returned when nothing is configured or no pattern matches.
 * @returns The concrete prefixes to query, de-duplicated and sorted.
 */
export async function resolveConfiguredPrefixes(
  redis: RedisConnection,
  configured: string[] | undefined,
  defaultPrefix: string,
): Promise<string[]> {
  if (!configured || configured.length === 0) {
    return [defaultPrefix];
  }

  const resolved = new Set<string>();
  for (const entry of configured) {
    if (entry === "*") {
      for (const prefix of await discoverPrefixes(redis)) {
        resolved.add(prefix);
      }
    } else if (entry.includes("*")) {
      for (const prefix of await discoverPrefixesMatching(redis, entry)) {
        resolved.add(prefix);
      }
    } else {
      resolved.add(entry);
    }
  }

  if (resolved.size === 0) {
    return [defaultPrefix];
  }
  return Array.from(resolved).sort();
}

/**
 * Expand a glob prefix pattern (e.g. `local:{*}`) into the concrete prefixes
 * present in Redis. Scans the `<pattern>:*:meta` / `<pattern>:*:id` key spaces
 * — `{` and `}` are literal in Redis glob matching, only `*` is a wildcard —
 * and derives each key's prefix from the pattern.
 *
 * @param redis - Redis client to scan (fans out across cluster masters).
 * @param pattern - Glob prefix pattern, e.g. `local:{*}`.
 * @returns The concrete prefixes matching the pattern, sorted alphabetically.
 */
export async function discoverPrefixesMatching(
  redis: RedisConnection,
  pattern: string,
): Promise<string[]> {
  const prefixes = new Set<string>();
  const matcher = prefixPatternToRegExp(pattern);
  const extractPrefix = (key: string) => matcher.exec(key)?.[0] ?? null;

  await collectPrefixes(redis, `${pattern}:*:meta`, extractPrefix, prefixes);
  await collectPrefixes(redis, `${pattern}:*:id`, extractPrefix, prefixes);

  return Array.from(prefixes).sort();
}

/**
 * Build an anchored regex that matches the prefix portion of a key for a glob
 * pattern. `*` becomes `[^:]*` (a wildcard confined to a single key segment),
 * every other character is matched literally. e.g. `local:{*}` →
 * `/^local:\{[^:]*\}/`, which extracts `local:{event}` from a full key.
 *
 * @param pattern - Glob prefix pattern (only `*` is treated as a wildcard).
 * @returns A start-anchored regex whose match is the key's prefix.
 */
export function prefixPatternToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\\\*/g, "[^:]*");
  return new RegExp(`^${escaped}`);
}

/**
 * SCAN for keys matching `pattern`, collecting each key's prefix (via
 * `extractPrefix`) into `out`.
 *
 * @param redis - Redis client to scan (fans out across cluster masters).
 * @param pattern - Redis glob MATCH pattern.
 * @param extractPrefix - Maps a matched key to its prefix, or `null` to skip it.
 * @param out - Set accumulating the discovered prefixes (mutated in place).
 */
async function collectPrefixes(
  redis: RedisConnection,
  pattern: string,
  extractPrefix: (key: string) => string | null,
  out: Set<string>,
): Promise<void> {
  await scanMatching(redis, pattern, (key) => {
    const prefix = extractPrefix(key);
    if (prefix) out.add(prefix);
  });
}
