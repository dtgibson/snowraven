// The readiness gate a host suite's map stub sits in (map-scroll-on-phones
// D-38). The store, the states and the shared assertions are in
// mapReadiness.ts; this file is the one component, so react-refresh's rule of
// one kind of export per file holds. Not a test file, but under src/, so
// tabOrderCoverage.test.ts reads it: the Retry is the Button primitive.

import { use, useSyncExternalStore, type ReactNode } from 'react'
import { Button } from '../components/ui/Button'
import { getMapReadiness, pendingChunk, setMapReadiness, subscribeMapReadiness } from './mapReadiness'

export function MapReadinessGate({ children }: { children?: ReactNode }) {
  const now = useSyncExternalStore(subscribeMapReadiness, getMapReadiness)
  if (now === 'chunk') use(pendingChunk())
  if (now === 'loading') return <div role="status" data-testid="map-not-drawn">Loading map…</div>
  if (now === 'failed') {
    return (
      <div role="alert" data-testid="map-not-drawn">
        <span>{"Map couldn't load. Check your connection."}</span>
        <Button type="button" onClick={() => setMapReadiness('ready')}>Retry</Button>
      </div>
    )
  }
  if (now === 'constructing') return <div data-testid="map-not-drawn" />
  return <>{children}</>
}
