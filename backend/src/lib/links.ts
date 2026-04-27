import type { Link } from '../models/index';

/**
 * Coerce raw input into a normalised Link[]:
 *  - undefined / null         → []
 *  - "string"                 → [{url:"string", description:""}]
 *  - ["a","b"]                → [{url:"a",…}, {url:"b",…}]
 *  - [{url, description}, …]  → passed through
 *
 * Used by services and the YAML seed loader so callers may supply any of the above.
 */
export function coerceLinks(raw: unknown): Link[] {
  if (raw == null) return [];
  if (typeof raw === 'string') {
    return raw ? [{ url: raw, description: '' }] : [];
  }
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    if (item == null) return [];
    if (typeof item === 'string') return item ? [{ url: item, description: '' }] : [];
    if (typeof item === 'object' && 'url' in (item as any)) {
      const obj = item as { url: unknown; description?: unknown };
      const url = typeof obj.url === 'string' ? obj.url : '';
      if (!url) return [];
      const description = typeof obj.description === 'string' ? obj.description : '';
      return [{ url, description }];
    }
    return [];
  });
}

/** JSON-encode a Link[] for Redis hash storage. Empty arrays serialise to '[]' (not ''). */
export function serialiseLinks(links: Link[] | undefined): string {
  return JSON.stringify(links ?? []);
}

/** Parse the JSON stored in Redis back into a Link[]; tolerates empty/invalid strings. */
export function parseLinks(raw: string | undefined): Link[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return coerceLinks(parsed);
  } catch {
    return [];
  }
}

/** All four link-array fields shared by Domain/SubDomain/Tribe/Squad/App. */
export const LINK_FIELDS = ['jira', 'confluence', 'github', 'mailingList'] as const;
export type LinkField = typeof LINK_FIELDS[number];
