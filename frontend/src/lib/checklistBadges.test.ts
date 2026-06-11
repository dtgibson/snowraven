import { describe, it, expect } from 'vitest'
import { deriveBadges } from './checklistBadges'
import { compareChecklists, type ChecklistData } from './compareChecklists'
import { formatWeather } from './weatherFormatter'
import type { HourlyResponse } from './weatherFormatter'
import { formatTide } from './tideFormatter'
import type { TideStation } from './tideStations'

const NO_MEDIA = { photo: 0, audio: 0, video: 0 }
const BASE_META = {
  protocolId: '', durationHrs: null, distanceKm: null, distanceUnit: '',
  numObservers: null, submissionMethod: '', submissionVersion: '', comments: '',
}

interface Sp {
  speciesCode: string; commonName: string; count: string
  breedingCode?: string; comments?: string
  media?: { photo: number; audio: number; video: number }
}

const cl = (species: Sp[], comments = ''): ChecklistData => ({
  locName: 'Loc', obsDt: '2024-01-01 06:30', ...BASE_META, comments,
  species: species.map(s => ({
    speciesCode: s.speciesCode, commonName: s.commonName, count: s.count,
    breedingCode: s.breedingCode ?? '', comments: s.comments ?? '',
    media: s.media ?? NO_MEDIA,
  })),
})

// Real weather/tide blocks for the comment-flag wiring.
const hour: HourlyResponse = {
  data: [{
    dt: 1716570000, temp: 64, humidity: 72, dew_point: 55, wind_speed: 6, wind_deg: 250,
    clouds: 20, weather: [{ id: 801, description: 'few clouds' }],
    sunrise: 1716550000, sunset: 1716600000,
  }],
}
const WEATHER_BLOCK = formatWeather([hour], 'America/Los_Angeles', 33.7)
const STN: TideStation = { id: '9410660', name: 'Los Angeles', lat: 33.7, lng: -118.2, state: 'CA', obs: true }
const TIDE_BLOCK = formatTide({
  levelMin: 4.1, levelMax: 5.3, source: 'predicted', trend: 'falling', turnedDuring: false,
  prevHL: null, nextHL: null, station: STN, distanceMi: 11.2,
})

describe('deriveBadges — media presence (FR-02)', () => {
  it('A has a photo, B does not → photo present on A, absent on B', () => {
    const a = cl([{ speciesCode: 'amerob', commonName: 'American Robin', count: '5', media: { photo: 2, audio: 0, video: 0 } }])
    const b = cl([{ speciesCode: 'amerob', commonName: 'American Robin', count: '3' }])
    const comp = compareChecklists(a, b)
    expect(deriveBadges(comp, 'a').photo).toBe(true)
    expect(deriveBadges(comp, 'b').photo).toBe(false)
  })

  it('ORs media across the side (A-only species counts for A, not B)', () => {
    const a = cl([
      { speciesCode: 'amerob', commonName: 'American Robin', count: '5' },
      { speciesCode: 'daejun', commonName: 'Dark-eyed Junco', count: '2', media: { photo: 0, audio: 1, video: 0 } },
    ])
    const b = cl([{ speciesCode: 'amerob', commonName: 'American Robin', count: '3' }])
    const comp = compareChecklists(a, b)
    const badgesA = deriveBadges(comp, 'a')
    expect(badgesA.audio).toBe(true)   // from A-only junco
    expect(badgesA.video).toBe(false)
    expect(deriveBadges(comp, 'b').audio).toBe(false)
  })

  it('reads the correct side column on a shared species', () => {
    const a = cl([{ speciesCode: 'amerob', commonName: 'American Robin', count: '5', media: { photo: 0, audio: 0, video: 3 } }])
    const b = cl([{ speciesCode: 'amerob', commonName: 'American Robin', count: '3', media: { photo: 1, audio: 0, video: 0 } }])
    const comp = compareChecklists(a, b)
    expect(deriveBadges(comp, 'a')).toMatchObject({ video: true, photo: false })
    expect(deriveBadges(comp, 'b')).toMatchObject({ photo: true, video: false })
  })
})

describe('deriveBadges — breeding presence (FR-04)', () => {
  it('A has a breeding code, B does not', () => {
    const a = cl([{ speciesCode: 'amerob', commonName: 'American Robin', count: '5', breedingCode: 'CN' }])
    const b = cl([{ speciesCode: 'amerob', commonName: 'American Robin', count: '3' }])
    const comp = compareChecklists(a, b)
    expect(deriveBadges(comp, 'a').breeding).toBe(true)
    expect(deriveBadges(comp, 'b').breeding).toBe(false)
  })
})

describe('deriveBadges — comment-block flags (FR-05/06)', () => {
  it("flags A's weather+tide comment, leaves B's plain comment unflagged", () => {
    const a = cl([{ speciesCode: 'amerob', commonName: 'American Robin', count: '5' }],
      `Onshore breeze.\n${WEATHER_BLOCK}\n${TIDE_BLOCK}`)
    const b = cl([{ speciesCode: 'amerob', commonName: 'American Robin', count: '3' }],
      'Spring migration in full swing.')
    const comp = compareChecklists(a, b)
    expect(deriveBadges(comp, 'a')).toMatchObject({ weatherComment: true, tideComment: true })
    expect(deriveBadges(comp, 'b')).toMatchObject({ weatherComment: false, tideComment: false })
  })

  it('weather-only comment flags weather, not tide', () => {
    const a = cl([{ speciesCode: 'amerob', commonName: 'American Robin', count: '5' }], WEATHER_BLOCK)
    const b = cl([{ speciesCode: 'houspa', commonName: 'House Sparrow', count: '1' }])
    const comp = compareChecklists(a, b)
    expect(deriveBadges(comp, 'a')).toMatchObject({ weatherComment: true, tideComment: false })
  })
})
