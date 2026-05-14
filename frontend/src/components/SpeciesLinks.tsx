interface SpeciesLinksProps {
  speciesCode: string | undefined
}

export function SpeciesLinks({ speciesCode }: SpeciesLinksProps) {
  if (!speciesCode) return null
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
        style={{ opacity: 0.75, display: 'inline-flex', alignItems: 'center' }}
        onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1' }}
        onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '0.75' }}
      >
        <img
          src="https://ebird.org/favicon.ico"
          width={14}
          height={14}
          style={{ display: 'block' }}
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
        />
      </a>
      <a
        href={`https://birdsoftheworld.org/bow/species/${speciesCode}/cur/introduction`}
        target="_blank"
        rel="noreferrer"
        style={{ opacity: 0.75, display: 'inline-flex', alignItems: 'center' }}
        onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '1' }}
        onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = '0.75' }}
      >
        <img
          src="https://birdsoftheworld.org/favicon.ico"
          width={14}
          height={14}
          style={{ display: 'block' }}
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
        />
      </a>
    </span>
  )
}
