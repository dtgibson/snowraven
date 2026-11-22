// The Family Tree table, the rollup (family-rollups-and-tree design-spec
// section 11; FR-36 to FR-45, FR-84, FR-86).
//
// It reads every count from the model (QA-33): no arithmetic over counts here
// beyond formatting, which the copy module does. Order headings over family
// disclosure rows; the whole family row is one `Button` with `aria-expanded`,
// and a closed family's contents are NOT rendered (FR-43), so a closed family
// contributes no focusable and no accessibility node, and toggling never
// unmounts the control that has focus (QA-41). Every species renders through
// `<BirdName>` in every Names state (FR-81). The list is an inline-size
// container that stacks its rows under 44em, and it has no scroller of its own
// on any tier (FR-86): it flows with the page.
//
// No DOM id or IDREF is minted from file content (FR-45): a row carries its
// family's ASSET index in a data attribute, which the tab's Find reads.

import { memo, useState } from 'react'
import { Camera, ChevronRight, ExternalLink, Mic, Video } from 'lucide-react'
import { Button } from '../ui/Button'
import { BirdName } from '../BirdName'
import { MediaPresenceCell } from '../MediaPresenceCell'
import { OutboundLink } from '../OutboundLink'
import { bowFamilyHref } from '../../lib/familyTreeLinks'
import type { FamilyIndex } from '../../lib/familyTreeAsset'
import type { FamilyModel, FamilyNode, GenusNode, OrderNode, SortKey, SpeciesLeaf } from '../../lib/familyTreeModel'
import { sortFamilies } from '../../lib/familyTreeModel'
import { familyNames, genusNames, nameOf, namingWords, orderNames, type NamesState } from '../../lib/familyTreeNames'
import {
  BOW_LINK_TEXT, COLUMN_FAMILY, COLUMN_SEEN, DOT_SEPARATOR, barWidth, bowLinkLabel, KIND_COPY, KIND_KEYS, NOT_PLACED_HEADING, NOT_PLACED_ROW, familyRowLabel,
  genusSpecies, itemsLabel, notPlacedReason, notPlacedRowLabel, notPlacedSub, orderFigures, seenOfWorld, share,
} from '../../lib/familyTreeCopy'
import type { CSSProperties } from 'react'

/** The open-set key of the Not placed group. */
export const NOT_PLACED_KEY = -1

const KIND_GLYPHS = { photo: Camera, audio: Mic, video: Video } as const

export interface FamilyTreeRollupProps {
  model: FamilyModel
  index: FamilyIndex
  names: NamesState
  sort: SortKey
  /** Open family indices, and NOT_PLACED_KEY for the Not placed group. */
  open: ReadonlySet<number>
  /** Keys a press just opened: their contents enter with the 180ms fade. */
  fresh: ReadonlySet<number>
  /** A running Expand all's rows mounted so far, per key; a key absent here is
   *  mounted in full (schema 9.2 as amended, D-43). */
  partial: ReadonlyMap<number, number>
  onToggle: (key: number) => void
  codeFor: (name: string) => string | undefined
  onOpenSpecies?: (commonName: string) => void
}

function barStyle(seen: number, world: number): CSSProperties {
  return { '--w': barWidth(seen, world) } as CSSProperties
}

function Bar({ seen, world }: { seen: number; world: number }) {
  return (
    <span className={seen > 0 ? 'sr-ft-bar' : 'sr-ft-bar is-zero'} aria-hidden="true">
      <i style={barStyle(seen, world)} />
    </span>
  )
}

function presence(kinds: number | null) {
  const k = kinds ?? 0
  return { photo: (k & 1) !== 0, audio: (k & 2) !== 0, video: (k & 4) !== 0 }
}

// Memoized, so a commit that adds rows to a family renders only the new rows
// (schema 9.2 as amended, D-43; the work-count row in FamilyTreeRollup.test.tsx).
const SpeciesRow = memo(function SpeciesRow({ leaf, spKey, names, codeFor, onOpenSpecies, mediaShown }: {
  leaf: SpeciesLeaf; spKey: string; names: NamesState; codeFor: (n: string) => string | undefined
  onOpenSpecies?: (n: string) => void; mediaShown: boolean
}) {
  // `spKey` is Find's handle on the row (design-spec 8's reveal): the asset
  // sequence, or the place in the unplaced list, never the name.
  return (
    <div className="sr-ft-sp" data-ft-sp={spKey}>
      <BirdName
        commonName={leaf.name}
        scientificName={leaf.sci}
        taxonCode={codeFor(leaf.name)}
        hasEntry
        onOpenSpecies={onOpenSpecies}
        showSci={names === 'both'}
        lead={names === 'scientific' ? 'scientific' : undefined}
        size="md"
      />
      {mediaShown && <MediaPresenceCell media={presence(leaf.kinds)} />}
    </div>
  )
})

interface FamilyOpenProps {
  family: FamilyNode; index: FamilyIndex; names: NamesState; codeFor: (n: string) => string | undefined
  onOpenSpecies?: (n: string) => void; mediaShown: boolean; isNew: boolean
  /** Species rows to mount, in genus order (Infinity: all of them). */
  limit: number
}

/** The open block's memo leaves `isNew` out: the entrance is latched at mount,
 *  so a later change of the entrance set re-renders nothing (D-43). */
function sameOpenBlock(a: FamilyOpenProps, b: FamilyOpenProps): boolean {
  return a.family === b.family && a.index === b.index && a.names === b.names && a.codeFor === b.codeFor
    && a.onOpenSpecies === b.onOpenSpecies && a.mediaShown === b.mediaShown && a.limit === b.limit
}

// FamilyOpen and FamilyRow are memoized so an Expand all step re-renders only
// the family it adds rows to, never every family opened before it (D-41, D-43).
const FamilyOpen = memo(function FamilyOpen({ family, index, names, codeFor, onOpenSpecies, mediaShown, isNew, limit }: FamilyOpenProps) {
  // A single press plays the entrance; rows Expand all mounts arrive without it.
  const [entering] = useState(isNew)
  const href = bowFamilyHref(index.families[family.family].code)
  const blocks: { g: GenusNode; shown: readonly SpeciesLeaf[] }[] = []
  let left = limit
  for (const g of family.genera) {
    if (left <= 0) break
    const shown = left >= g.species.length ? g.species : g.species.slice(0, left)
    left -= shown.length
    blocks.push({ g, shown })
  }
  return (
    <div className={entering ? 'sr-ft-open is-new' : 'sr-ft-open'}>
      {/* The family's Birds of the World link, the tree readout's own (same
          builder, flag, guard, text and name; D-55(a), NFR-07). It mounts
          with the block's frame, outside the species rows a step counts. */}
      {href !== null ? (
        <p className="sr-ft-open-links">
          <OutboundLink href={href} className="sr-ft-out sr-touch-target" aria-label={bowLinkLabel(index.families[family.family].name)}>
            {BOW_LINK_TEXT}<ExternalLink size={12} strokeWidth={2.2} aria-hidden="true" />
          </OutboundLink>
        </p>
      ) : null}
      {blocks.map(({ g, shown }) => {
        const n = genusNames(index, g.genus)
        const nm = nameOf('genus', n.common, n.scientific, names)
        return (
          <div key={g.genus} className="sr-ft-genus-block">
            <p className="sr-ft-genus">
              <b className={nm.leadItalic ? 'is-sci' : undefined}>{nm.lead}</b>
              {nm.alt !== null && <span className={nm.altItalic ? 'alt is-sci' : 'alt'}>{nm.alt}</span>}
              <span>{genusSpecies(g.seen)}</span>
            </p>
            {shown.map(s => (
              <SpeciesRow key={s.name} leaf={s} spKey={`s${s.seq}`} names={names} codeFor={codeFor} onOpenSpecies={onOpenSpecies} mediaShown={mediaShown} />
            ))}
          </div>
        )
      })}
    </div>
  )
}, sameOpenBlock)

const FamilyRow = memo(function FamilyRow({ order, family, index, names, flat, isOpen, onToggle, mediaShown }: {
  order: OrderNode; family: FamilyNode; index: FamilyIndex; names: NamesState; flat: boolean
  isOpen: boolean; onToggle: (k: number) => void; mediaShown: boolean
}) {
  const fn = familyNames(index, family.family)
  const nm = nameOf('family', fn.common, fn.scientific, names)
  const on = orderNames(index, order.order)
  const orderLead = nameOf('order', on.common, on.scientific, names).lead
  const second = [nm.alt, flat ? orderLead : null].filter((x): x is string => x !== null)
  const sw = seenOfWorld(family.seen, family.world)
  return (
    <Button
      type="button"
      className="sr-ft-frow"
      aria-expanded={isOpen}
      aria-label={familyRowLabel([namingWords(nm), ...(flat ? [orderLead] : [])].join(', '), family.seen, family.world, mediaShown ? family.withKind : null, mediaShown ? family.items : null)}
      data-ft-family={family.family}
      onClick={() => onToggle(family.family)}
    >
      <ChevronRight size={14} strokeWidth={2.2} className="sr-ft-rowchev" aria-hidden="true" />
      <span className="sr-ft-fname">
        <span className="n">{nm.lead}</span>
        {second.length > 0 && <span className="s">{second.join(DOT_SEPARATOR)}</span>}
      </span>
      <span className="sr-ft-seen">
        <span className="sr-ft-seen-figs">
          <span><b>{sw.seen}</b>{sw.rest}</span>
          <span className="pct">{share(family.seen, family.world)}</span>
        </span>
        <Bar seen={family.seen} world={family.world} />
      </span>
      {mediaShown && family.withKind !== null && family.items !== null && KIND_KEYS.map((k, i) => (
        <span key={k} className={family.withKind![i] === 0 ? 'sr-ft-mc is-zero' : 'sr-ft-mc'}>
          <b>{family.withKind![i]}</b>
          {family.items![i] > 0 && <span>{itemsLabel(k, family.items![i])}</span>}
        </span>
      ))}
      {mediaShown && family.withKind !== null && (
        <span className="sr-ft-mline">
          {KIND_KEYS.map((k, i) => {
            const Glyph = KIND_GLYPHS[k]
            return (
              <span key={k}>
                <Glyph size={12} strokeWidth={2.2} aria-hidden="true" />
                <b>{family.withKind![i]}</b>
              </span>
            )
          })}
        </span>
      )}
    </Button>
  )
})

export const FamilyTreeRollup = memo(function FamilyTreeRollup({
  model, index, names, sort, open, fresh, partial, onToggle, codeFor, onOpenSpecies,
}: FamilyTreeRollupProps) {
  const mediaShown = model.mediaShown
  const family = (order: OrderNode, f: FamilyNode, flat: boolean) => {
    const isOpen = open.has(f.family)
    return (
      <div key={f.family} className="sr-ft-fblock">
        <FamilyRow order={order} family={f} index={index} names={names} flat={flat} isOpen={isOpen} onToggle={onToggle} mediaShown={mediaShown} />
        {isOpen && <FamilyOpen family={f} index={index} names={names} codeFor={codeFor} onOpenSpecies={onOpenSpecies} mediaShown={mediaShown} isNew={fresh.has(f.family)} limit={partial.get(f.family) ?? Infinity} />}
      </div>
    )
  }
  const unplacedOpen = open.has(NOT_PLACED_KEY)
  return (
    <div className="sr-ft-list">
      <div className="sr-ft-cols" aria-hidden="true">
        <span className="c-name">{COLUMN_FAMILY}</span>
        <span>{COLUMN_SEEN}</span>
        {mediaShown && KIND_KEYS.map(k => {
          const Glyph = KIND_GLYPHS[k]
          return <span key={k} className="c-m"><Glyph size={12} strokeWidth={2.2} />{KIND_COPY[k].column}</span>
        })}
      </div>
      {sort === 'taxonomic'
        ? model.orders.map(order => {
          const on = orderNames(index, order.order)
          const nm = nameOf('order', on.common, on.scientific, names)
          const figs = orderFigures(order.seen, order.world, order.familiesSeen, order.familiesWorld)
          return (
            <section key={order.order} className="sr-ft-order" data-ft-order={order.order}>
              <div className="sr-ft-oband">
                <h3>
                  {nm.lead}
                  {nm.alt !== null && <span className="alt"> {nm.alt}</span>}
                </h3>
                <p><b>{figs.seen}</b>{figs.rest1}<b>{figs.families}</b>{figs.rest2}</p>
              </div>
              {order.families.map(f => family(order, f, false))}
            </section>
          )
        })
        : sortFamilies(model, index, sort).map(({ order, family: f }) => family(order, f, true))}
      {model.unplaced.length > 0 && (
        <section className="sr-ft-order sr-ft-unplaced">
          <div className="sr-ft-oband">
            <h3>{NOT_PLACED_HEADING}</h3>
            <p><b>{model.unplaced.length}</b> species</p>
          </div>
          <div className="sr-ft-fblock">
            <Button
              type="button"
              className="sr-ft-frow sr-ft-frow--unplaced"
              aria-expanded={unplacedOpen}
              aria-label={notPlacedRowLabel(model.unplaced.length)}
              data-ft-family={NOT_PLACED_KEY}
              onClick={() => onToggle(NOT_PLACED_KEY)}
            >
              <ChevronRight size={14} strokeWidth={2.2} className="sr-ft-rowchev" aria-hidden="true" />
              <span className="sr-ft-fname">
                <span className="n">{NOT_PLACED_ROW}</span>
                <span className="s">{notPlacedSub(model.unplaced.length)}</span>
              </span>
            </Button>
            {unplacedOpen && (
              <div className={fresh.has(NOT_PLACED_KEY) ? 'sr-ft-open is-new' : 'sr-ft-open'}>
                <p className="sr-ft-reason">{notPlacedReason(model.unplaced.length)}</p>
                {(partial.has(NOT_PLACED_KEY) ? model.unplaced.slice(0, partial.get(NOT_PLACED_KEY)) : model.unplaced).map((s, i) => (
                  <SpeciesRow key={s.name} leaf={s} spKey={`u${i}`} names={names} codeFor={codeFor} onOpenSpecies={onOpenSpecies} mediaShown={mediaShown} />
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  )
})
