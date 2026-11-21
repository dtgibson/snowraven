// eBird region codes → human names for display. eBird "State/Province" values are
// ISO-style subnational codes like "US-MN" or "CA-ON". We cover the US (states +
// DC + territories) and Canada (provinces/territories) — the common cases — and
// fall back to the raw code for anything else, so display never breaks.

const US: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'Washington, D.C.', PR: 'Puerto Rico', VI: 'U.S. Virgin Islands', GU: 'Guam',
  AS: 'American Samoa', MP: 'Northern Mariana Islands', UM: 'U.S. Minor Outlying Islands',
}

const CA: Record<string, string> = {
  AB: 'Alberta', BC: 'British Columbia', MB: 'Manitoba', NB: 'New Brunswick',
  NL: 'Newfoundland and Labrador', NS: 'Nova Scotia', NT: 'Northwest Territories',
  NU: 'Nunavut', ON: 'Ontario', PE: 'Prince Edward Island', QC: 'Quebec',
  SK: 'Saskatchewan', YT: 'Yukon',
}

/** Full name for an eBird region code (e.g. "US-MN" → "Minnesota"); falls back
 *  to the code itself for regions we don't have a name for. The tables are read
 *  through `Object.hasOwn`: the code is a State/Province cell of the user's own
 *  file, and a bare `US[sub]` gave `"US-__proto__"` Object.prototype, which
 *  Statistics rendered as a React child and lost its geographic section
 *  (security.md, the lookup-table rule; idea 25608818). */
export function regionName(code: string | null | undefined): string {
  if (!code) return ''
  const [country, sub] = code.split('-')
  if (country === 'US' && sub && Object.hasOwn(US, sub)) return US[sub]
  if (country === 'CA' && sub && Object.hasOwn(CA, sub)) return CA[sub]
  return code
}

/** The shape of an eBird State/Province code (ISO 3166-2: two letters, a hyphen,
 *  one to three letters or digits: "US-CA", "CH-VS", "FR-ARA", "IT-23"). A cell
 *  becomes an ebird.org/region link only in this shape; anything else renders
 *  as plain text (security.md, an id from CSV data is shape-validated before it
 *  becomes a link). Not `isRegionCode`, which is the US county shape and would
 *  refuse every state. */
export const SUBNATIONAL_CODE_RE = /^[A-Z]{2}-[A-Z0-9]{1,3}$/

export function isSubnationalCode(code: unknown): code is string {
  return typeof code === 'string' && SUBNATIONAL_CODE_RE.test(code)
}
