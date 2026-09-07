// Every user-facing string the Weather section renders, and every function that
// builds one from a count.
//
// WHY THEY LIVE HERE RATHER THAN IN THE COMPONENT. A copy guard states RULES
// over a GENERATED corpus -- no count of one takes a plural noun, no determiner
// takes a bare "1", no plural verb follows a subject counted at one, no em dash,
// no ranked or predictive phrasing -- and a count-bearing string built inline in
// a component (`{n} {n === 1 ? 'checklist' : 'checklists'}`) is invisible to
// that sweep however correct it happens to be today. `weatherStatsCopy.test.ts`
// generates its corpus by calling everything below across a grid of counts, so
// a new string joins the sweep by being added here and nowhere else.
//
// THE SECTION'S REGISTER, which decides the wording as much as the rules do:
// evidential, never analytical. Every figure states what it counts and how many
// things are behind it. Nothing predicts, ranks or recommends -- "best
// conditions for", "you should try", "expect to find" and the word
// "correlation" do not appear, and no ranked list of species by weather is
// rendered anywhere.

import { fmt, fmtSharePct } from './statsFormat'
import { WEATHER_BAND_MIN_TO_SHOW } from './weatherStats'

const s = (n: number, singular: string, plural: string) => (n === 1 ? singular : plural)

/** Static strings, so they ride the sweep with the generated ones. */
export const WEATHER_COPY = {
  cardTitle: 'Weather',
  coverageLabel: 'Checklists with a weather block',
  route: 'Fill in the gaps on the Weather tab',
  distributionHeading: 'Your outings by weather',
  threeDenominators:
    'Each axis counts the readable blocks that carried that field, so the three '
    + 'totals differ: a checklist can have a temperature and no wind.',
  axisSky: 'By sky',
  axisTemp: 'By temperature',
  axisWind: 'By wind',
  axisDayNight: 'Day and night',
  skyFootnote:
    'A checklist is grouped by the sky glyph in its own block, not by the weather '
    + "service's wording. Other is the glyph SnowRaven writes when the service returns "
    + 'a sky code it has no category for; the temperature and wind in those blocks still '
    + 'count everywhere else on this card.',
  windFootnote:
    "Blocks record wind as a Beaufort description, so these are the app's own "
    + 'bands rather than a speed.',
  dayNightFootnote:
    'A block written after dark carries a moon phase beside its sky glyph, which is '
    + 'what marks the checklist as night.',
  speciesHeading: 'Species and time out, by weather',
  confound:
    'Weather changes how long you stay out, so a lower species count can be the weather '
    + 'or it can be the outing. Average time out sits beside every average so you can '
    + 'see both.',
  legendSpecies: 'Species per checklist',
  legendDuration: 'Average time out',
  legendNoOutings: 'No outings',
  thinBand: 'Too few to average.',
  zeroBandCondition: 'No outings in this condition.',
  zeroBandTemp: 'No outings in this band.',
  pickerHeading: 'One species, its weather',
  belowFloorBody:
    'Every figure here is about the checklists that carry a weather block SnowRaven or '
    + 'RainCrow wrote, so filling in more blocks is what sharpens it.',
  axisToggleGroup: 'Choose the axis',
  axisToggleTemp: 'Temperature',
  axisToggleSky: 'Sky',
  pickerAll: 'All species',
  pickerAria: 'Filter by species',
} as const

/**
 * `25% · 301 of 1,214` -- the header-row denominator above the ratio bar.
 *
 * Every count-bearing string here is offered BOTH whole and in parts. The whole
 * is what the corpus sweep reads; the parts are what the component renders, so
 * a figure can be emphasised without the component slicing a sentence back apart
 * on a separator, which is the shape that breaks silently the first time the
 * wording changes.
 */
export function coverageDenominator(readable: number, total: number): string {
  return `${coveragePct(readable, total)}% · ${coverageCounts(readable, total)}`
}

/** `301 of 1,214` -- the un-emphasised half of the denominator above. */
export function coverageCounts(readable: number, total: number): string {
  return `${fmt(readable)} of ${fmt(total)}`
}

/** A whole percent, floored at 0 rather than rounded below it. The section's
 *  other shares use `fmtSharePct`; this one is the headline figure and is
 *  printed beside its own numerator and denominator, so it needs no "<1%". */
export function coveragePct(readable: number, total: number): number {
  return total > 0 ? Math.round((readable / total) * 100) : 0
}

/** The sentence that has to be above every chart. */
export function coverageSentence(readable: number, total: number): string {
  return `These figures cover the ${fmt(readable)} ${s(readable, 'checklist', 'checklists')} `
    + `that ${s(readable, 'carries', 'carry')} a weather block SnowRaven or RainCrow wrote. That is `
    + `${coveragePct(readable, total)}% of your ${fmt(total)} ${s(total, 'checklist', 'checklists')}.`
}

/** Appended to the coverage sentence only when blocks were found that the
 *  parser could not read at all. A quietly-broken parser then shows up as a
 *  number rather than as a smaller chart. */
export function unreadableClause(unreadable: number): string {
  if (unreadable <= 0) return ''
  return ` ${fmt(unreadable)} more ${s(unreadable, 'carries', 'carry')} a block this app could not read.`
}

/** The below-floor state's first line, which IS the coverage line there. */
export function belowFloorLine(readable: number): string {
  return `You have ${fmt(readable)} ${s(readable, 'checklist', 'checklists')} with a readable `
    + `weather block. That is not enough to chart yet.`
}

export type WeatherAxis = 'sky' | 'temp' | 'wind' | 'daynight'

const AXIS_NOUN: Record<WeatherAxis, string> = {
  sky: 'a sky condition',
  temp: 'a temperature',
  wind: 'a wind reading',
  daynight: 'a time of day',
}

/** `298 with a sky condition` -- each axis states its OWN denominator, because
 *  a checklist can have a temperature and no wind. */
export function axisDenominator(n: number, axis: WeatherAxis): string {
  return `${fmt(n)} ${axisDenominatorSuffix(axis)}`
}

/** `with a sky condition` -- the part that is not the emphasised figure. */
export function axisDenominatorSuffix(axis: WeatherAxis): string {
  return `with ${AXIS_NOUN[axis]}`
}

/** `44 checklists` / `1 checklist`, in a band's head row. */
export function bandHeadCount(n: number): string {
  return `${fmt(n)} ${s(n, 'checklist', 'checklists')}`
}

/** The temperature footnote answers the one decision most able to mislead: a
 *  block records a RANGE and is counted once, at its midpoint. */
export function tempFootnote(medianSpanF: number | null): string {
  const lead = 'A block records a range, because it covers every hour of the outing. '
    + 'Each checklist is counted once, in the band its midpoint falls in.'
  if (medianSpanF === null) return lead
  if (medianSpanF === 0) {
    // "span 0°F or less" is technically true and reads like a glitch.
    return `${lead} Half your blocks record a single temperature rather than a range.`
  }
  return `${lead} Half your blocks span ${fmt(medianSpanF)}°F or less.`
}

/** `A band averages only once it has 8 checklists.` -- built from the constant
 *  rather than re-spelling the number. */
export function legendFloorNote(): string {
  return `A band averages only once it has ${fmt(WEATHER_BAND_MIN_TO_SHOW)} `
    + `${s(WEATHER_BAND_MIN_TO_SHOW, 'checklist', 'checklists')}.`
}

/** `14.7 species per checklist`. One decimal, because a mean of species counts
 *  is not a whole number and rounding it to a whole one would overstate. */
export function speciesFigure(avg: number): string {
  return `${speciesFigureValue(avg)} ${SPECIES_FIGURE_SUFFIX}`
}

export function speciesFigureValue(avg: number): string {
  return avg.toFixed(1)
}

export const SPECIES_FIGURE_SUFFIX = 'species per checklist'

/** The duration figure's own denominator is part of the figure, never a note
 *  beside it: it can be smaller than the band's checklist count. */
export function durationFigureUnit(avgMin: number): string {
  return `${fmt(Math.round(avgMin))} min`
}

export function durationFigureDenominator(durationCount: number): string {
  return `· from ${fmt(durationCount)} with a time`
}

/** A band with enough checklists to average SPECIES but not enough with a
 *  recorded time. No rail is drawn for it: an empty rail here would be the
 *  zero-band treatment, which means something else entirely. */
export function thinDurationsLine(durationCount: number): string {
  return `Only ${fmt(durationCount)} of these ${s(durationCount, 'has', 'have')} a recorded time, `
    + `too few to average.`
}

/** The picker's rest state, as a lead sentence and its quieter qualifier. */
export function pickerRestParts(readable: number): { lead: string; note: string } {
  return {
    lead: 'Pick a species to see the skies and temperatures you have it on.',
    note: 'Counts are checklists, not sightings, and they only ever cover the '
      + `${fmt(readable)} ${s(readable, 'checklist', 'checklists')} with a readable block.`,
  }
}

export function pickerRestLine(readable: number): string {
  const p = pickerRestParts(readable)
  return `${p.lead} ${p.note}`
}

/** The selected species' opening figure. The NAME renders through `BirdName`, so
 *  these are the two sentences that follow it. */
export function speciesLedeParts(onCount: number, readable: number): { lead: string; note: string } {
  return {
    lead: `is on ${fmt(onCount)} of your ${fmt(readable)} weather-block `
      + `${s(readable, 'checklist', 'checklists')}.`,
    note: 'Counts are checklists, not sightings.',
  }
}

export function speciesLede(onCount: number, readable: number): string {
  const p = speciesLedeParts(onCount, readable)
  return `${p.lead} ${p.note}`
}

/**
 * The confound, named once above the pair, then shown per row.
 *
 * The bars are the bird's OWN record, so they carry when the user was out as
 * well as the bird. That trap is real and it is the reason the earlier
 * shared-rail treatment existed; the reference figure on each row is what
 * replaces it, and this sentence is what tells the reader the two numbers are
 * different wholes. Same move as the effort confound one block up.
 */
export function speciesChartNote(speciesName: string): string {
  return `This is where ${speciesName} turned up, so it reflects when you were out as well as `
    + `the bird. Each row carries its share of the bird's records, then the same band's share `
    + `of all your outings.`
}

/** The share of the SPECIES' OWN axis total that this band holds -- the `25%`
 *  in `19 · 25%`. Floored at "<1%" for a nonzero count, because a band the bird
 *  really was in must never read as one it was not. */
export function speciesRowShare(count: number, speciesAxisTotal: number): string {
  return fmtSharePct(count, speciesAxisTotal)
}

/**
 * The reference figure: the same band's share of ALL the user's outings on that
 * axis, which is denominator 2 restated per row. Labelled in words for the same
 * reason denominator 4 is: two shares of two different wholes sit on one line,
 * and neither may be readable as the other.
 *
 * A no-outings band gets NO reference. "outings 0%" only repeats what
 * "no outings" already said, and printing it would collapse the one distinction
 * this chart most needs: a band the bird was never in (a fact about the bird)
 * against a band the user has never birded (a fact about the birder).
 */
export function speciesRowReference(bandN: number, axisTotal: number): string {
  return bandN === 0 ? '' : `outings ${fmtSharePct(bandN, axisTotal)}`
}

/** `77 of its 78 have a sky condition`. The "of its 78" is deliberate: it names
 *  the species by the pronoun the lede one line above has already bound, so a
 *  skimmer cannot read 77 as an outing count and think it disagrees with the
 *  card's own coverage figure. */
export function speciesGroupDenominator(sum: number, speciesTotal: number, axis: 'sky' | 'temp'): string {
  // The verb agrees with the SUM, which is the subject: "1 of its 1 has a sky
  // condition". Reachable -- a bird can be on one weather-block checklist.
  return `${fmt(sum)} of its ${fmt(speciesTotal)} ${s(sum, 'has', 'have')} ${AXIS_NOUN[axis]}`
}

/** The band the user has never birded. Deliberately carries no numeral, so it
 *  can never be mistaken for the `0 · 0%` beside it. */
export const NO_OUTINGS = 'no outings'
