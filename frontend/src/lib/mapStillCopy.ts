// Every string the phone-tier map still and its fullscreen add (map-scroll-on-phones,
// design-refinement.md "Content Notes"). One module, so the em-dash and copy
// sweeps reach them and no host re-types a label.
//
// Entry-safe on purpose: plain constants, no imports. NamedBirdRow.tsx and
// WeatherForecastPanel.tsx sit on App.tsx's static graph and read these through
// components/ui/FsOpenRow.tsx.
//
// No em dash and no literal non-ASCII character in this source: the one
// typographic apostrophe is written as an escape.

/** The opener's visible label, on every map. */
export const OPEN_MAP_LABEL = 'Open the map'

/** The helper line under the opener on the maps that only pan and zoom. */
export const OPEN_MAP_NOTE = 'It opens in fullscreen, where it pans and zooms.'

/** The helper line under the Weather location picker's opener. */
export const OPEN_PICKER_NOTE = 'Open the map to drop a pin, or type coordinates below.'

/** The visible word on the fullscreen exit, phone tier. Its accessible name
 *  stays `Exit fullscreen`, which contains it (WCAG 2.5.3). */
export const EXIT_WORD = 'Exit'

/** The Weather picker's top-centre statement while expanded. */
export const PICKER_NOTE_NO_PIN = 'Tap the map to drop a pin.'
export const PICKER_NOTE_PIN = 'Drag the pin to fine-tune. Exit when it is in place.'

/** The page's helper line under the picker above the phone tier (HEAD). */
export const PICKER_PAGE_NOTE = 'Tap the map to drop a pin, drag to fine-tune, or type coordinates below.'

/** Each still's accessible name while it is a picture (D-18). The Hotspot
 *  Reports name stays `mapLabel(name)` in hotspotReportsCopy.ts. */
export const STILL_NAMES = {
  species: 'Map showing sighting locations',
  statistics: 'Map showing Geographic Stats',
  named: 'Map showing this bird’s sightings',
  picker: 'Map showing the chosen place',
  explorer: 'Map',
} as const
