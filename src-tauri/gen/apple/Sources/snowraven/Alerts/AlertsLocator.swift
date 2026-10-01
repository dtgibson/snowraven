// The alert check's location read (ios-alerts, FR-15, FR-17; schema.md 4.2).
//
// This file READS the When In Use status and, for a check the app itself runs
// while it is open under My location, one position. It never asks for any
// permission: the only location prompt in the app remains the geolocation
// plugin behind the webview's "Use my location" and "My location" controls.
// No background mode, no significant-change monitoring, no continuous updates
// (a guard greps Sources/snowraven/** for those API names). A background check
// never calls `currentPosition` at all; the engine enforces that.
//
// A recent fix (under five minutes old) is used as is; otherwise one
// `requestLocation()` at hundred-metre accuracy, bounded at 10 s (the widget's
// numbers). The first of the answer or the bound wins.

import CoreLocation
import Foundation

final class AlertsLocator: AlertsLocating, @unchecked Sendable {
    func authorization() async -> LocationAuth {
        await MainActor.run {
            switch CLLocationManager().authorizationStatus {
            case .notDetermined: return .notDetermined
            case .authorizedWhenInUse, .authorizedAlways: return .granted
            case .denied: return .denied
            case .restricted: return .restricted
            @unknown default: return .denied
            }
        }
    }

    func currentPosition() async -> Coordinate? {
        await AlertsLocationRequest.run()
    }
}

@MainActor
final class AlertsLocationRequest: NSObject, CLLocationManagerDelegate {
    static let waitSeconds: TimeInterval = 10
    static let recentFixSeconds: TimeInterval = 5 * 60

    private var manager: CLLocationManager?
    private var continuation: CheckedContinuation<Coordinate?, Never>?

    static func run() async -> Coordinate? {
        await AlertsLocationRequest().current()
    }

    private func current() async -> Coordinate? {
        let m = CLLocationManager()
        switch m.authorizationStatus {
        case .authorizedWhenInUse, .authorizedAlways: break
        default: return nil
        }
        if let loc = m.location, -loc.timestamp.timeIntervalSinceNow < AlertsLocationRequest.recentFixSeconds {
            return Coordinate(lat: loc.coordinate.latitude, lng: loc.coordinate.longitude)
        }
        m.desiredAccuracy = kCLLocationAccuracyHundredMeters
        return await withCheckedContinuation { c in
            self.continuation = c
            self.manager = m
            m.delegate = self
            m.requestLocation()
            DispatchQueue.main.asyncAfter(deadline: .now() + AlertsLocationRequest.waitSeconds) { [weak self] in
                self?.finish(nil)
            }
        }
    }

    private func finish(_ r: Coordinate?) {
        guard let c = continuation else { return }
        continuation = nil
        manager?.delegate = nil
        manager = nil
        c.resume(returning: r)
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        let c = locations.last?.coordinate
        Task { @MainActor in self.finish(c.map { Coordinate(lat: $0.latitude, lng: $0.longitude) }) }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in self.finish(nil) }
    }
}
