// The single, app-wide way to render a bird's name. Common name links to the
// Species Detail tab when the user has an entry for it (hasEntry); the eBird +
// Birds of the World favicons (SpeciesLinks) always follow; the scientific name
// is shown, stacked beneath, only where there's room (showSci). Purely
// presentational — callers supply the taxon code and the navigation handler.

import { SpeciesLinks } from './SpeciesLinks'

export interface BirdNameProps {
  /** Common name (may include a subspecies parenthetical). */
  commonName: string
  /** Scientific name; shown only when showSci is true and space allows. */
  scientificName?: string
  /** eBird species code — drives the favicons (and is a no-op when absent). */
  taxonCode?: string
  /** True ⇒ the common name links to the user's Species Detail entry. */
  hasEntry?: boolean
  /** Navigate to + select this species on the Species Detail tab. */
  onOpenSpecies?: (commonName: string) => void
  /** Opt in to the stacked scientific-name line (default off). */
  showSci?: boolean
  /** Text scale: 'sm' (dense/popups), 'md' (table default), 'lg' (prominent stat). */
  size?: 'sm' | 'md' | 'lg'
}

export function BirdName({
  commonName,
  scientificName,
  taxonCode,
  hasEntry = false,
  onOpenSpecies,
  showSci = false,
  size = 'md',
}: BirdNameProps) {
  const linkable = hasEntry && !!onOpenSpecies
  const sci = showSci && scientificName ? scientificName : null
  const cls = `sr-birdname sr-birdname-${size}${sci ? '' : ' sr-birdname-inline'}`

  return (
    <span className={cls}>
      <span className="sr-birdname-row">
        {linkable ? (
          <button
            type="button"
            className="sr-birdname-link"
            tabIndex={0}
            onClick={() => onOpenSpecies!(commonName)}
          >
            {commonName}
          </button>
        ) : (
          <span className="sr-birdname-text">{commonName}</span>
        )}
        <SpeciesLinks speciesCode={taxonCode} commonName={commonName} />
      </span>
      {sci && <span className="sr-birdname-sci">{sci}</span>}
    </span>
  )
}
