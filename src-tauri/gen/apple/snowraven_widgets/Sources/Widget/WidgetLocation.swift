// Location at refresh time (ios-lifer-widgets FR-17 to FR-20). The extension
// declares `NSWidgetUsesLocation` and rides the app's When In Use grant: it
// never requests authorization and never asks for Always, so the only prompt
// the user ever sees is the app's own. `isAuthorizedForWidgetUpdates` false
// (or any status short of When In Use) means "unavailable" with no attempt, and
// the engine falls back to the saved Default Location (S7) or S6.
//
// A recent fix (under five minutes old) is used as is; otherwise one
// `requestLocation()` at hundred-metre accuracy, the app's own iOS setting,
// bounded by `waitSeconds` (OQ-07: 10 s; to be re-measured on a device for a
// cold fix). The first of the answer or the bound wins; the other is ignored.

import CoreLocation
import Foundation

struct CoreLocationLocator: WidgetLocator {
    func currentLocation() async -> LocationResult {
        await LocationRequest.run()
    }
}

@MainActor
final class LocationRequest: NSObject, CLLocationManagerDelegate {
    static let waitSeconds: TimeInterval = 10
    static let recentFixSeconds: TimeInterval = 5 * 60

    private var manager: CLLocationManager?
    private var continuation: CheckedContinuation<LocationResult, Never>?

    static func run() async -> LocationResult {
        await LocationRequest().current()
    }

    private func current() async -> LocationResult {
        let m = CLLocationManager()
        guard m.isAuthorizedForWidgetUpdates else { return .unavailable }
        switch m.authorizationStatus {
        case .authorizedWhenInUse, .authorizedAlways: break
        default: return .unavailable
        }
        if let loc = m.location, -loc.timestamp.timeIntervalSinceNow < LocationRequest.recentFixSeconds {
            return .located(Coordinate(lat: loc.coordinate.latitude, lng: loc.coordinate.longitude))
        }
        m.desiredAccuracy = kCLLocationAccuracyHundredMeters
        return await withCheckedContinuation { c in
            self.continuation = c
            self.manager = m
            m.delegate = self
            m.requestLocation()
            DispatchQueue.main.asyncAfter(deadline: .now() + LocationRequest.waitSeconds) { [weak self] in
                self?.finish(.unavailable)
            }
        }
    }

    private func finish(_ r: LocationResult) {
        guard let c = continuation else { return }
        continuation = nil
        manager?.delegate = nil
        manager = nil
        c.resume(returning: r)
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        let c = locations.last?.coordinate
        Task { @MainActor in
            self.finish(c.map { .located(Coordinate(lat: $0.latitude, lng: $0.longitude)) } ?? .unavailable)
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in self.finish(.unavailable) }
    }
}
