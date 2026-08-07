import { describe, it, expect } from 'vitest'
import { computeFrivolousLists, AVIAN_AMERICAN, CALIFORNIA_DREAMER, PHOEBE_PHANATIC, BEST_OF_THE_CREST, RAINBOW_COLORS } from './frivolousLists'
import type { ObservationEntry } from '../types'

let _sub = 1
function obs(partial: Partial<ObservationEntry> & { commonName: string; date: string }): ObservationEntry {
  return {
    submissionId: partial.submissionId ?? `S${_sub++}`,
    commonName: partial.commonName,
    scientificName: partial.scientificName ?? 'Genus species',
    date: partial.date,
    location: partial.location ?? 'Somewhere',
    locationId: partial.locationId ?? 'L1',
    latitude: partial.latitude ?? null,
    longitude: partial.longitude ?? null,
    county: partial.county ?? null,
    count: partial.count ?? null,
    breedingCode: partial.breedingCode ?? null,
    speciesComments: partial.speciesComments ?? '',
    catalogIds: partial.catalogIds ?? [],
  }
}

describe('computeFrivolousLists — name lists (Avian American / California Dreamer)', () => {
  it('checks off recorded species and reports recorded/total/complete', () => {
    const data = computeFrivolousLists([
      obs({ commonName: 'American Robin', date: '2020-01-01' }),
      obs({ commonName: 'American Crow', date: '2020-01-02' }),
      obs({ commonName: 'Mourning Dove', date: '2020-01-03' }), // not on any list
    ])
    expect(data.avianAmerican.total).toBe(22)
    expect(data.avianAmerican.total).toBe(AVIAN_AMERICAN.length)
    expect(data.avianAmerican.recorded).toBe(2)
    expect(data.avianAmerican.complete).toBe(false)
    const robin = data.avianAmerican.items.find(i => i.commonName === 'American Robin')
    expect(robin?.recorded).toBe(true)
    const goshawk = data.avianAmerican.items.find(i => i.commonName === 'American Goshawk')
    expect(goshawk?.recorded).toBe(false)
  })

  it('preserves the given order of the list', () => {
    const data = computeFrivolousLists([])
    expect(data.avianAmerican.items.map(i => i.commonName)).toEqual([...AVIAN_AMERICAN])
    expect(data.californiaDreamer.items.map(i => i.commonName)).toEqual([...CALIFORNIA_DREAMER])
  })

  it('marks a list complete only when every species is recorded', () => {
    const all = CALIFORNIA_DREAMER.map((name, i) => obs({ commonName: name, date: `2020-02-${String(i + 1).padStart(2, '0')}` }))
    const data = computeFrivolousLists(all)
    expect(data.californiaDreamer.recorded).toBe(7)
    expect(data.californiaDreamer.complete).toBe(true)
  })

  it('ticks a species recorded only as a subspecies (normalized match)', () => {
    const data = computeFrivolousLists([
      obs({ commonName: 'American Robin (eastern)', date: '2020-01-01' }),
    ])
    expect(data.avianAmerican.items.find(i => i.commonName === 'American Robin')?.recorded).toBe(true)
  })

  it('an empty backup checks nothing off', () => {
    const data = computeFrivolousLists([])
    expect(data.avianAmerican.recorded).toBe(0)
    expect(data.californiaDreamer.recorded).toBe(0)
    expect(data.avianAmerican.complete).toBe(false)
  })
})

describe('computeFrivolousLists — new flat lists (v0.5.39)', () => {
  it('checks off the three new flat lists', () => {
    const data = computeFrivolousLists([
      obs({ commonName: 'Black Phoebe', date: '2020-01-01' }),
      obs({ commonName: 'Island Scrub-Jay', date: '2020-01-02' }),
      obs({ commonName: 'Sinaloa Crow', date: '2020-01-03' }),
    ])
    expect(data.phoebePhanatic.total).toBe(3)
    expect(data.phoebePhanatic.recorded).toBe(1)
    expect(data.scrubJayAllDay.total).toBe(4)
    expect(data.scrubJayAllDay.recorded).toBe(1)
    expect(data.crowRaven.total).toBe(6)
    expect(data.crowRaven.items.find(i => i.commonName === 'Sinaloa Crow')?.recorded).toBe(true)
    expect(data.crowRaven.complete).toBe(false)
  })

  it('completes a flat list when every species is recorded', () => {
    const all = [...PHOEBE_PHANATIC].map((n, i) => obs({ commonName: n, date: `2021-01-0${i + 1}` }))
    const data = computeFrivolousLists(all)
    expect(data.phoebePhanatic.recorded).toBe(3)
    expect(data.phoebePhanatic.complete).toBe(true)
  })
})

describe('computeFrivolousLists — grouped lists (v0.5.39)', () => {
  it('aggregates recorded/total across all sub-groups, preserving group order', () => {
    const data = computeFrivolousLists([
      obs({ commonName: 'Great Blue Heron', date: '2020-01-01' }),       // True Herons
      obs({ commonName: 'Western Cattle-Egret', date: '2020-01-02' }),   // Egrets (the corrected name)
      obs({ commonName: 'American Bittern', date: '2020-01-03' }),       // Bitterns
    ])
    expect(data.heronIsCarin.total).toBe(12)
    expect(data.heronIsCarin.recorded).toBe(3)
    expect(data.heronIsCarin.complete).toBe(false)
    expect(data.heronIsCarin.groups.map(g => g.groupName)).toEqual(['True Herons', 'Egrets', 'Night-Herons', 'Bitterns'])
  })

  it('matches the corrected current-eBird names within their sub-group', () => {
    const data = computeFrivolousLists([
      obs({ commonName: 'Black-crowned Night Heron', date: '2020-02-01' }),
    ])
    const night = data.heronIsCarin.groups.find(g => g.groupName === 'Night-Herons')!
    expect(night.items.find(i => i.commonName === 'Black-crowned Night Heron')?.recorded).toBe(true)
    expect(data.heronIsCarin.recorded).toBe(1)
  })

  it('Best of the Crest spans all 16 sub-groups with the expected total', () => {
    const total = BEST_OF_THE_CREST.reduce((a, g) => a + g.species.length, 0)
    const data = computeFrivolousLists([])
    expect(data.bestOfTheCrest.total).toBe(total)
    expect(data.bestOfTheCrest.total).toBe(38)
    expect(data.bestOfTheCrest.groups.length).toBe(BEST_OF_THE_CREST.length)
    expect(data.bestOfTheCrest.recorded).toBe(0)
    expect(data.bestOfTheCrest.complete).toBe(false)
  })

  it('a species shared by two lists ticks in both', () => {
    const data = computeFrivolousLists([obs({ commonName: 'Great Blue Heron', date: '2020-01-01' })])
    const inHeron = data.heronIsCarin.groups.find(g => g.groupName === 'True Herons')!
      .items.find(i => i.commonName === 'Great Blue Heron')?.recorded
    const inCrest = data.bestOfTheCrest.groups.find(g => g.groupName === 'Herons')!
      .items.find(i => i.commonName === 'Great Blue Heron')?.recorded
    expect(inHeron).toBe(true)
    expect(inCrest).toBe(true)
  })
})

describe('computeFrivolousLists — Rainbow Connection', () => {
  it('returns seven rows in spectrum order', () => {
    const data = computeFrivolousLists([])
    expect(data.rainbowConnection.rows.map(r => r.color)).toEqual([...RAINBOW_COLORS])
    expect(data.rainbowConnection.total).toBe(7)
  })

  it('matches a color only as a whole word', () => {
    const data = computeFrivolousLists([
      obs({ commonName: 'Reddish Egret', date: '2019-01-01' }),     // NOT red
      obs({ commonName: 'Black Redstart', date: '2019-01-02' }),    // NOT red
      obs({ commonName: 'American Redstart', date: '2019-01-03' }), // NOT red
      obs({ commonName: 'Red-tailed Hawk', date: '2019-02-01' }),   // red ✓
    ])
    const red = data.rainbowConnection.rows.find(r => r.color === 'red')!
    expect(red.bird?.commonName).toBe('Red-tailed Hawk')
  })

  it('picks the earliest-first-seen bird for a color', () => {
    const data = computeFrivolousLists([
      obs({ commonName: 'Red-winged Blackbird', date: '2019-03-03', location: 'Marsh' }),
      obs({ commonName: 'Red-tailed Hawk', date: '2018-05-01', location: 'Ridge' }),     // earlier
      obs({ commonName: 'Red Crossbill', date: '2020-12-01', location: 'Pines' }),
    ])
    const red = data.rainbowConnection.rows.find(r => r.color === 'red')!
    expect(red.bird?.commonName).toBe('Red-tailed Hawk')
    expect(red.bird?.date).toBe('2018-05-01')
    expect(red.bird?.location).toBe('Ridge')
  })

  it('uses a species\' earliest sighting date, not a later one', () => {
    const data = computeFrivolousLists([
      obs({ commonName: 'Blue Jay', date: '2021-06-01', submissionId: 'S900' }),
      obs({ commonName: 'Blue Jay', date: '2017-01-09', submissionId: 'S100', location: 'Backyard' }),
    ])
    const blue = data.rainbowConnection.rows.find(r => r.color === 'blue')!
    expect(blue.bird?.date).toBe('2017-01-09')
    expect(blue.bird?.location).toBe('Backyard')
    expect(blue.bird?.submissionId).toBe('S100')
  })

  it('lets one bird satisfy two colors (Violet-green Swallow → violet AND green)', () => {
    const data = computeFrivolousLists([
      obs({ commonName: 'Violet-green Swallow', date: '2019-04-01' }),
    ])
    expect(data.rainbowConnection.rows.find(r => r.color === 'violet')!.bird?.commonName).toBe('Violet-green Swallow')
    expect(data.rainbowConnection.rows.find(r => r.color === 'green')!.bird?.commonName).toBe('Violet-green Swallow')
  })

  it('avoids doubling a bird across colors when a distinct alternative exists', () => {
    const data = computeFrivolousLists([
      obs({ commonName: 'Violet-green Swallow', date: '2018-04-01' }), // matches violet AND green; earliest
      obs({ commonName: 'Green Heron', date: '2019-06-01' }),          // matches green only
    ])
    // Even though the Swallow was seen first, green takes the Heron so violet keeps the Swallow — no double.
    expect(data.rainbowConnection.rows.find(r => r.color === 'violet')!.bird?.commonName).toBe('Violet-green Swallow')
    expect(data.rainbowConnection.rows.find(r => r.color === 'green')!.bird?.commonName).toBe('Green Heron')
  })

  it('resolves a multi-color contest to distinct birds where possible', () => {
    const data = computeFrivolousLists([
      obs({ commonName: 'Violet-green Swallow', date: '2018-01-01' }), // violet + green
      obs({ commonName: 'Green Heron', date: '2020-01-01' }),          // green only
      obs({ commonName: 'Blue Jay', date: '2019-01-01' }),             // blue only
    ])
    expect(data.rainbowConnection.rows.find(r => r.color === 'green')!.bird?.commonName).toBe('Green Heron')
    expect(data.rainbowConnection.rows.find(r => r.color === 'violet')!.bird?.commonName).toBe('Violet-green Swallow')
    expect(data.rainbowConnection.rows.find(r => r.color === 'blue')!.bird?.commonName).toBe('Blue Jay')
  })

  it('gives a higher-priority color its earliest bird when distinctness still holds', () => {
    const data = computeFrivolousLists([
      obs({ commonName: 'Yellow-green Vireo', date: '2018-01-01' }), // yellow + green; earliest
      obs({ commonName: 'Yellow Warbler', date: '2019-01-01' }),     // yellow only
      obs({ commonName: 'Green Heron', date: '2020-01-01' }),        // green only
    ])
    // yellow (higher in the spectrum) keeps its earliest (the Vireo); green takes the
    // Heron — both distinct. Plain max-matching would bump yellow onto the later Warbler.
    expect(data.rainbowConnection.rows.find(r => r.color === 'yellow')!.bird?.commonName).toBe('Yellow-green Vireo')
    expect(data.rainbowConnection.rows.find(r => r.color === 'green')!.bird?.commonName).toBe('Green Heron')
  })

  it('is deterministic under input reordering when two species tie on date and submission id', () => {
    const rows = [
      obs({ commonName: 'Blue-gray Gnatcatcher', date: '2024-03-04', submissionId: 'S7' }),
      obs({ commonName: 'Blue Jay', date: '2024-03-04', submissionId: 'S7' }),
    ]
    const blueOf = (rs: typeof rows) =>
      computeFrivolousLists(rs).rainbowConnection.rows.find(r => r.color === 'blue')!.bird?.commonName
    expect(blueOf(rows)).toBe(blueOf([...rows].reverse()))
  })

  it('matches a color only on a whole word in compound names', () => {
    const data = computeFrivolousLists([
      obs({ commonName: 'Common Yellowthroat', date: '2019-01-01' }),    // NOT yellow ("Yellowthroat")
      obs({ commonName: 'Green-winged Teal', date: '2019-02-01' }),      // green
      obs({ commonName: 'Orange-crowned Warbler', date: '2019-03-01' }), // orange
    ])
    expect(data.rainbowConnection.rows.find(r => r.color === 'yellow')!.bird).toBeNull()
    expect(data.rainbowConnection.rows.find(r => r.color === 'green')!.bird?.commonName).toBe('Green-winged Teal')
    expect(data.rainbowConnection.rows.find(r => r.color === 'orange')!.bird?.commonName).toBe('Orange-crowned Warbler')
  })

  it('assigns two species that match the same two colors to distinct colors', () => {
    const data = computeFrivolousLists([
      obs({ commonName: 'Blue-and-yellow Macaw', date: '2019-01-01' }),  // blue + yellow
      obs({ commonName: 'Yellow-and-blue Conure', date: '2019-02-01' }), // blue + yellow
    ])
    const blue = data.rainbowConnection.rows.find(r => r.color === 'blue')!.bird?.commonName
    const yellow = data.rainbowConnection.rows.find(r => r.color === 'yellow')!.bird?.commonName
    expect(blue).not.toBe(yellow)
    expect([blue, yellow].sort()).toEqual(['Blue-and-yellow Macaw', 'Yellow-and-blue Conure'])
  })

  it('shows a color its earliest bird as a forced double when a double is unavoidable', () => {
    const data = computeFrivolousLists([
      obs({ commonName: 'Violet-green Swallow', date: '2020-01-01', submissionId: 'S3' }), // green + violet
      obs({ commonName: 'Yellow-green Vireo', date: '2020-01-01', submissionId: 'S1' }),    // yellow + green
    ])
    // Three fillable colors (yellow, green, violet) but only two species — one color
    // must double. green's earliest is the Vireo (S1 < S3); it shows the Vireo (a double
    // with yellow) rather than relocating the double onto violet via the later Swallow.
    expect(data.rainbowConnection.rows.find(r => r.color === 'yellow')!.bird?.commonName).toBe('Yellow-green Vireo')
    expect(data.rainbowConnection.rows.find(r => r.color === 'green')!.bird?.commonName).toBe('Yellow-green Vireo')
    expect(data.rainbowConnection.rows.find(r => r.color === 'violet')!.bird?.commonName).toBe('Violet-green Swallow')
  })

  it('leaves a color empty when no recorded bird matches', () => {
    const data = computeFrivolousLists([
      obs({ commonName: 'Red-tailed Hawk', date: '2019-01-01' }),
    ])
    expect(data.rainbowConnection.rows.find(r => r.color === 'indigo')!.bird).toBeNull()
    expect(data.rainbowConnection.complete).toBe(false)
  })

  it('is complete when all seven colors are filled', () => {
    const data = computeFrivolousLists([
      obs({ commonName: 'Red Knot', date: '2019-01-01' }),
      obs({ commonName: 'Orange Bishop', date: '2019-01-02' }),
      obs({ commonName: 'Yellow Warbler', date: '2019-01-03' }),
      obs({ commonName: 'Green Heron', date: '2019-01-04' }),
      obs({ commonName: 'Blue Jay', date: '2019-01-05' }),
      obs({ commonName: 'Indigo Bunting', date: '2019-01-06' }),
      obs({ commonName: 'Violet-green Swallow', date: '2019-01-07' }),
    ])
    expect(data.rainbowConnection.filled).toBe(7)
    expect(data.rainbowConnection.complete).toBe(true)
  })

  it('breaks earliest-date ties deterministically by lowest submission id', () => {
    const forward = computeFrivolousLists([
      obs({ commonName: 'Red Knot', date: '2019-01-01', submissionId: 'S2' }),
      obs({ commonName: 'Red-tailed Hawk', date: '2019-01-01', submissionId: 'S1' }),
    ])
    const reverse = computeFrivolousLists([
      obs({ commonName: 'Red-tailed Hawk', date: '2019-01-01', submissionId: 'S1' }),
      obs({ commonName: 'Red Knot', date: '2019-01-01', submissionId: 'S2' }),
    ])
    expect(forward.rainbowConnection.rows.find(r => r.color === 'red')!.bird?.submissionId).toBe('S1')
    expect(reverse.rainbowConnection.rows.find(r => r.color === 'red')!.bird?.submissionId).toBe('S1')
  })

  it('excludes spuh, slash, and " x " hybrid names from color matching', () => {
    const data = computeFrivolousLists([
      obs({ commonName: 'greenish sp.', date: '2019-01-01' }),
      obs({ commonName: 'Blue-winged/Cinnamon Teal', date: '2019-01-02' }),
      obs({ commonName: 'Mallard x American Black Duck', date: '2019-01-03' }),
    ])
    expect(data.rainbowConnection.rows.find(r => r.color === 'green')!.bird).toBeNull()
    expect(data.rainbowConnection.rows.find(r => r.color === 'blue')!.bird).toBeNull()
  })
})
