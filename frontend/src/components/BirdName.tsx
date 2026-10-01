// The single, app-wide way to render a bird's name. Common name links to the
// Species Detail tab when the user has an entry for it (hasEntry); the eBird +
// Birds of the World favicons (SpeciesLinks) always follow; the scientific name
// is shown, stacked beneath, only where there's room (showSci). Purely
// presentational — callers supply the taxon code and the navigation handler.

import { Button } from './ui/Button'
import { Fragment, memo } from 'react'
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
  /** Opt in to a line-break opportunity (`<wbr>`) after each "/" in the common
   *  name, so a slash name ("Eastern/Western Warbling Vireo") wraps after the
   *  slash in a narrow box rather than mid-word (taxonomic-splits-lumps). `<wbr>`
   *  contributes no character, so the text content and accessible name are
   *  unchanged. Default off: every other surface renders byte-identically. */
  breakAfterSlash?: boolean
}

/** The common name with a `<wbr>` after each "/". Keys are segment indexes. */
function withSlashBreaks(name: string) {
  const segments = name.split('/')
  return segments.map((seg, i) => (
    <Fragment key={i}>
      {seg}
      {i < segments.length - 1 && <>/<wbr /></>}
    </Fragment>
  ))
}

export const BirdName = memo(function BirdName({
  commonName,
  scientificName,
  taxonCode,
  hasEntry = false,
  onOpenSpecies,
  showSci = false,
  size = 'md',
  breakAfterSlash = false,
}: BirdNameProps) {
  const linkable = hasEntry && !!onOpenSpecies
  const shown = breakAfterSlash && commonName.includes('/') ? withSlashBreaks(commonName) : commonName
  const sci = showSci && scientificName ? scientificName : null
  const cls = `sr-birdname sr-birdname-${size}${sci ? '' : ' sr-birdname-inline'}`

  return (
    <span className={cls}>
      <span className="sr-birdname-row">
        {linkable ? (
          <Button
            type="button"
            className="sr-birdname-link"
            onClick={() => onOpenSpecies!(commonName)}
          >
            {shown}
          </Button>
        ) : (
          <span className="sr-birdname-text">{shown}</span>
        )}
        <SpeciesLinks speciesCode={taxonCode} commonName={commonName} />
      </span>
      {sci && <span className="sr-birdname-sci">{sci}</span>}
    </span>
  )
})
