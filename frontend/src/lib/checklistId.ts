/** Pull the eBird submission ID out of a pasted checklist ID or full URL
 * (e.g. "https://ebird.org/checklist/S12345678?foo" → "S12345678"). */
export function extractChecklistId(raw: string): string {
  const s = raw.trim().replace(/\/+$/, '').split('?')[0]
  return s.includes('/') ? (s.split('/').pop() ?? s) : s
}

/** eBird submission IDs look like S12345678. */
export function isValidChecklistId(id: string): boolean {
  return /^S\d+$/.test(id)
}
