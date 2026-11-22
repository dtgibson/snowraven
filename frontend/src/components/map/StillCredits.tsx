// The map credits on a phone-tier still are drawn OPEN (map-scroll-on-phones
// D-17). The still is inert, so the "i" that would open the compact credits
// cannot be pressed there, and a collapsed credit would be an unreadable one.
//
// WHY THIS IS NOT A STYLESHEET RULE, which is what the design asked for
// (decisions.md D-20). maplibre-gl 6.8 draws the compact credits as a
// `<details class="maplibregl-ctrl-attrib maplibregl-compact">`, and its own
// "i" toggles both the element's `open` attribute and its
// `maplibregl-compact-show` class. Once a user has collapsed the credits the
// `<details>` is CLOSED, and a closed `<details>` does not render its content at
// all: no author rule on `.maplibregl-ctrl-attrib-inner` can draw it, whatever
// its specificity. So while the map is a still this puts the control into
// maplibre's OWN shown state (both halves, exactly as its toggle leaves them),
// and maplibre's toggle keeps working on it in fullscreen.
//
// A `<SnowMap>` child, so it has the live instance; map-side, so it stays off
// the entry chunk with MapCornerControls.

import { useEffect } from 'react'
import { useMap } from 'react-map-gl/maplibre'

export function StillCredits({ still }: { still: boolean }) {
  const map = useMap().current
  useEffect(() => {
    if (!still || !map || typeof map.getContainer !== 'function') return
    const box = map.getContainer()
    if (!box || typeof box.querySelector !== 'function') return
    const credits = box.querySelector<HTMLDetailsElement>('details.maplibregl-ctrl-attrib.maplibregl-compact')
    if (!credits) return
    credits.setAttribute('open', '')
    credits.classList.add('maplibregl-compact-show')
  }, [still, map])
  return null
}
