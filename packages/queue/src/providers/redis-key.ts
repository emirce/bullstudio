export function parseQueueNameFromKey(
  key: string,
  prefix: string,
  suffix: string,
): string | null {
  const keyPrefix = `${prefix}:`;
  const keySuffix = `:${suffix}`;

  if (!key.startsWith(keyPrefix) || !key.endsWith(keySuffix)) {
    return null;
  }

  const name = key.slice(keyPrefix.length, -keySuffix.length);
  return name || null;
}
