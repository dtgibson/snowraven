// Map Explorer content class list. `sr-map-ios-fullscreen` scopes the
// globals.css rules that make the sidebar the phone-tier overlay and reveal
// the Filters FAB at ANY width — applied only on iOS builds while the map is
// fullscreen (user-approved at the mobile-app design review: fullscreen hides
// the sidebar, the map owns the entire canvas; exiting restores the in-flow
// sidebar). Desktop/web fullscreen behavior is unchanged: the class is never
// applied there, so the (phone-tier ≤640) rules alone decide, as shipped.
export function mapContentClass(iosFullscreen: boolean): string {
  return iosFullscreen ? 'sr-map-content sr-map-ios-fullscreen' : 'sr-map-content';
}
