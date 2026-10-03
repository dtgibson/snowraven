// Map Explorer content class list. `sr-map-ios-fullscreen` scopes the
// globals.css rules that make the sidebar the phone-tier overlay and reveal
// the Filters FAB at ANY width — applied only in the mobile apps (iPhone, iPad
// and Android) while the map is fullscreen (user-approved at the mobile-app
// design review: fullscreen hides the sidebar, the map owns the entire canvas;
// exiting restores the in-flow sidebar; Android takes the same reading,
// android-release FR-19). Desktop/web fullscreen behavior is unchanged: the
// class is never applied there, so the (phone-tier ≤640) rules alone decide,
// as shipped. The class keeps its shipped name; it is not load-bearing.
import { isMobileApp } from './platform';

// The one expression for "the mobile fullscreen tier" (android-release schema
// 5.2: was `isIOS() && !!isFullscreen` inline in MapExplorer).
export function mobileMapFullscreen(isFullscreen: boolean | undefined): boolean {
  return isMobileApp() && !!isFullscreen;
}

export function mapContentClass(mobileFullscreen: boolean): string {
  return mobileFullscreen ? 'sr-map-content sr-map-ios-fullscreen' : 'sr-map-content';
}
