interface SpeciesLinksProps {
  speciesCode: string | undefined
  /** Common name — used to give each favicon link an accessible name. */
  commonName?: string
}

export function SpeciesLinks({ speciesCode, commonName }: SpeciesLinksProps) {
  if (!speciesCode) return null
  const who = commonName ? `${commonName} ` : ''
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      marginLeft: 6,
      verticalAlign: 'middle',
    }}>
      <a
        href={`https://ebird.org/species/${speciesCode}`}
        target="_blank"
        rel="noreferrer"
        aria-label={`View ${who}on eBird`}
        title={`View ${who}on eBird`}
        style={{ opacity: 0.75, display: 'inline-flex', alignItems: 'center' }}
        onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1' }}
        onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '0.75' }}
      >
        <span className="sr-favicon-slot">
          <img
            src="https://ebird.org/favicon.ico"
            className="sr-favicon"
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            width={14}
            height={14}
            style={{ display: 'block' }}
            onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
          />
        </span>
      </a>
      <a
        href={`https://birdsoftheworld.org/bow/species/${speciesCode}/cur/introduction`}
        target="_blank"
        rel="noreferrer"
        aria-label={`View ${who}on Birds of the World`}
        title={`View ${who}on Birds of the World`}
        style={{ opacity: 0.75, display: 'inline-flex', alignItems: 'center' }}
        onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1' }}
        onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '0.75' }}
      >
        <span className="sr-favicon-slot">
          <img
            src="https://birdsoftheworld.org/favicon.ico"
            className="sr-favicon"
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            width={14}
            height={14}
            style={{ display: 'block' }}
            onError={e => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }}
          />
        </span>
      </a>
    </span>
  )
}
