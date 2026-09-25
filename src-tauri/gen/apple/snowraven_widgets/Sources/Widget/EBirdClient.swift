// The widget's only network code (ios-lifer-widgets FR-21, NFR-02, NFR-04):
// one GET to api.ebird.org over HTTPS with the user's key, from a request the
// Logic layer built and validated. Redirects are refused (the redirect
// response is returned as a status and treated as a failure), cookies and the
// URL cache are off, and the body is capped at `EBirdRequest.bodyCapBytes` by
// `EBirdBody.collect` (Logic, tested): refused by its declared length or as
// soon as the received bytes pass it, so a body that would not fit the
// extension's memory is never held (schema.md section 6.5). Nothing about the
// request or the response is logged.

import Foundation

final class EBirdClient: NSObject, WidgetTransport, URLSessionTaskDelegate, @unchecked Sendable {
    private lazy var session: URLSession = {
        let c = URLSessionConfiguration.ephemeral
        c.httpShouldSetCookies = false
        c.httpCookieAcceptPolicy = .never
        c.urlCache = nil
        c.requestCachePolicy = .reloadIgnoringLocalCacheData
        c.timeoutIntervalForRequest = EBirdRequest.timeoutSeconds
        c.timeoutIntervalForResource = EBirdRequest.timeoutSeconds + 5
        c.waitsForConnectivity = false
        return URLSession(configuration: c, delegate: self, delegateQueue: nil)
    }()

    func fetch(_ request: URLRequest) async -> FetchResult {
        guard let url = request.url, url.scheme == "https", url.host == EBirdRequest.host else { return .offline }
        do {
            let (bytes, response) = try await session.bytes(for: request)
            guard let http = response as? HTTPURLResponse else { return .offline }
            guard http.statusCode == 200 else {
                return .status(http.statusCode, retryAfter: http.value(forHTTPHeaderField: "Retry-After"))
            }
            switch try await EBirdBody.collect(bytes, declaredLength: http.expectedContentLength) {
            case .ok(let data): return .ok(data)
            case .tooLarge: return .tooLarge
            }
        } catch let e as URLError {
            return e.code == .timedOut ? .timeout : .offline
        } catch {
            return .offline
        }
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, willPerformHTTPRedirection response: HTTPURLResponse,
                    newRequest request: URLRequest) async -> URLRequest? {
        nil
    }
}
