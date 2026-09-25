// The widget's one request (ios-lifer-widgets, schema.md section 6.1, FR-21):
// eBird's data/obs/geo/recent over HTTPS with the user's own key, and nothing
// else. The only interpolated values are two numbers printed to five
// decimals (as `toFixed(5)` prints them) and a key the hand-over validator
// already held to `^[A-Za-z0-9]{1,128}$`, a class that cannot express a
// separator, host, scheme or header break. `maxResults` is deliberately not
// sent, so this is the app's own request; the bound is the body-size cap in
// the transport (schema.md section 6.5).

import Foundation

enum EBirdRequest {
    static let host = "api.ebird.org"
    static let path = "/v2/data/obs/geo/recent"
    static let backDays = 30
    static let timeoutSeconds: TimeInterval = 20
    /// The response body bound: about 5,500 records at eBird's record size,
    /// far above any real 40 km / 30 day body (a few hundred records), and
    /// inside the extension's memory limit with margin (measured, schema 6.5).
    static let bodyCapBytes = 2_000_000

    static func urlString(for c: Coordinate) -> String {
        "https://\(host)\(path)?lat=\(JSNumber.toFixed(c.lat, 5))&lng=\(JSNumber.toFixed(c.lng, 5))"
            + "&dist=\(WidgetCache.distKm)&back=\(backDays)&fmt=json"
    }

    static func make(for c: Coordinate, key: String) -> URLRequest? {
        guard Handover.isValidKey(key), let url = URL(string: urlString(for: c)) else { return nil }
        var r = URLRequest(url: url, cachePolicy: .reloadIgnoringLocalCacheData, timeoutInterval: timeoutSeconds)
        r.httpMethod = "GET"
        r.httpShouldHandleCookies = false
        r.setValue(key, forHTTPHeaderField: "X-eBirdApiToken")
        return r
    }
}

/// The body cap itself (schema.md section 6.5, QA-50), a pure function over any
/// byte sequence so the test target reaches it without the network: a declared
/// length over the cap is refused before a byte is read, and an undeclared or
/// understated body is refused at the first byte past the cap, which is pulled
/// but never stored. So at most `cap` bytes are ever held, and the rest of an
/// oversized body is never read. `EBirdClient` feeds it the response's bytes.
enum EBirdBody {
    enum Outcome: Equatable {
        case ok(Data)
        case tooLarge
    }

    static func collect<S: AsyncSequence>(_ bytes: S, declaredLength: Int64,
                                          cap: Int = EBirdRequest.bodyCapBytes) async throws -> Outcome
    where S.Element == UInt8 {
        if declaredLength > Int64(cap) { return .tooLarge }
        var data = Data()
        data.reserveCapacity(Int(max(0, min(declaredLength, Int64(cap)))))
        for try await byte in bytes {
            if data.count == cap { return .tooLarge }
            data.append(byte)
        }
        return .ok(data)
    }
}
