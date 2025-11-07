/**
 * Normalizes a string so it can be used safely in DOM ids and URL segments.
 * Matches the legacy taxonomy + item detail slug behaviour while sharing one source.
 */
export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}
