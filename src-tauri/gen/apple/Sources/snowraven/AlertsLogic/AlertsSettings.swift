// `alerts/settings.json`, version 1 (ios-alerts, schema.md 3.2), and the
// settings patch the webview sends through `alerts_update_settings`.
//
// Validated on EVERY read: a key outside the field table, a wrong type or an
// out-of-bound value makes the whole document read as the DEFAULTS with
// `enabled: false`, the safe direction (FR-03): a corrupted file cannot turn
// alerts on. The patch is validated field by field and applied all-or-nothing:
// any unknown key or bad value refuses the whole edit ("invalid") and nothing
// changes. The same validator runs before every write (the write chokepoint).

import Foundation

enum AlertCadence: String, Codable, Sendable { case hourly, daily }

enum AlertModel: String, Codable, Sendable {
    case fixed
    case myLocation = "my-location"
}

struct QuietHoursSetting: Codable, Equatable, Sendable {
    var on: Bool
    var startMin: Int
    var endMin: Int

    static let fieldNames: Set<String> = ["on", "startMin", "endMin"]

    init(on: Bool, startMin: Int, endMin: Int) { self.on = on; self.startMin = startMin; self.endMin = endMin }

    init(from decoder: Decoder) throws {
        try StrictKeys.check(decoder, QuietHoursSetting.fieldNames)
        let c = try decoder.container(keyedBy: CodingKeys.self)
        on = try c.decode(Bool.self, forKey: .on)
        startMin = try c.decode(Int.self, forKey: .startMin)
        endMin = try c.decode(Int.self, forKey: .endMin)
    }

    var isValid: Bool { AlertValidate.minute(startMin) && AlertValidate.minute(endMin) }
}

/// A hand-set fixed place. `name` is the place-name search's string, or nil
/// when the place was entered as coordinates or set by Use my location.
struct FixedPlace: Codable, Equatable, Sendable {
    var lat: Double
    var lng: Double
    var name: String?

    static let fieldNames: Set<String> = ["lat", "lng", "name"]
    private enum CodingKeys: String, CodingKey { case lat, lng, name }

    init(lat: Double, lng: Double, name: String?) { self.lat = lat; self.lng = lng; self.name = name }

    init(from decoder: Decoder) throws {
        try StrictKeys.check(decoder, FixedPlace.fieldNames)
        let c = try decoder.container(keyedBy: CodingKeys.self)
        lat = try c.decode(Double.self, forKey: .lat)
        lng = try c.decode(Double.self, forKey: .lng)
        name = try c.decodeIfPresent(String.self, forKey: .name)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(lat, forKey: .lat)
        try c.encode(lng, forKey: .lng)
        if let n = name { try c.encode(n, forKey: .name) } else { try c.encodeNil(forKey: .name) }
    }

    var isValid: Bool {
        guard AlertValidate.lat(lat), AlertValidate.lng(lng) else { return false }
        if let n = name { return AlertValidate.displayName(n, max: AlertRules.placeNameMaxUnits) }
        return true
    }
}

struct AlertsSettings: Codable, Equatable, Sendable {
    var version: Int
    var enabled: Bool
    var cadence: AlertCadence
    var quietHours: QuietHoursSetting
    var model: AlertModel
    /// nil = FOLLOW the saved Default Location (the hand-over's, read at check time).
    var fixedPlace: FixedPlace?
    var radiusMi: Int
    var updatedAt: String

    static let currentVersion = 1
    static let fieldNames: Set<String> = [
        "version", "enabled", "cadence", "quietHours", "model", "fixedPlace", "radiusMi", "updatedAt",
    ]
    private enum CodingKeys: String, CodingKey {
        case version, enabled, cadence, quietHours, model, fixedPlace, radiusMi, updatedAt
    }

    static func defaults(now: Date) -> AlertsSettings {
        AlertsSettings(version: currentVersion, enabled: false, cadence: .hourly,
                       quietHours: QuietHoursSetting(on: false, startMin: AlertRules.quietDefaultStart,
                                                     endMin: AlertRules.quietDefaultEnd),
                       model: .fixed, fixedPlace: nil, radiusMi: AlertRules.radiusDefault,
                       updatedAt: WidgetTime.string(now))
    }

    init(version: Int, enabled: Bool, cadence: AlertCadence, quietHours: QuietHoursSetting, model: AlertModel,
         fixedPlace: FixedPlace?, radiusMi: Int, updatedAt: String) {
        self.version = version; self.enabled = enabled; self.cadence = cadence; self.quietHours = quietHours
        self.model = model; self.fixedPlace = fixedPlace; self.radiusMi = radiusMi; self.updatedAt = updatedAt
    }

    init(from decoder: Decoder) throws {
        try StrictKeys.check(decoder, AlertsSettings.fieldNames)
        let c = try decoder.container(keyedBy: CodingKeys.self)
        version = try c.decode(Int.self, forKey: .version)
        enabled = try c.decode(Bool.self, forKey: .enabled)
        cadence = try c.decode(AlertCadence.self, forKey: .cadence)
        quietHours = try c.decode(QuietHoursSetting.self, forKey: .quietHours)
        model = try c.decode(AlertModel.self, forKey: .model)
        fixedPlace = try c.decodeIfPresent(FixedPlace.self, forKey: .fixedPlace)
        radiusMi = try c.decode(Int.self, forKey: .radiusMi)
        updatedAt = try c.decode(String.self, forKey: .updatedAt)
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: CodingKeys.self)
        try c.encode(version, forKey: .version)
        try c.encode(enabled, forKey: .enabled)
        try c.encode(cadence, forKey: .cadence)
        try c.encode(quietHours, forKey: .quietHours)
        try c.encode(model, forKey: .model)
        if let f = fixedPlace { try c.encode(f, forKey: .fixedPlace) } else { try c.encodeNil(forKey: .fixedPlace) }
        try c.encode(radiusMi, forKey: .radiusMi)
        try c.encode(updatedAt, forKey: .updatedAt)
    }

    var isValid: Bool {
        guard version == AlertsSettings.currentVersion, quietHours.isValid, AlertValidate.radius(radiusMi),
              AlertValidate.time(updatedAt) else { return false }
        if let f = fixedPlace, !f.isValid { return false }
        return true
    }

    /// The document at these bytes, or nil (absent, over its bound, unknown
    /// key, wrong type, out of bound). The caller reads nil as the defaults.
    static func decode(_ data: Data) -> AlertsSettings? {
        guard data.count <= AlertsFiles.settingsMaxBytes,
              let s = try? JSONDecoder().decode(AlertsSettings.self, from: data), s.isValid else { return nil }
        return s
    }

    /// The bytes to write, or nil when the value fails its own validator.
    func encoded() -> Data? {
        guard isValid, let d = try? JSONEncoder().encode(self), d.count <= AlertsFiles.settingsMaxBytes else { return nil }
        return d
    }
}

// MARK: - The settings patch (alerts_update_settings)

struct AlertsSettingsPatch: Equatable, Sendable {
    var cadence: AlertCadence?
    var quietHours: QuietHoursSetting?
    var model: AlertModel?
    /// `.some(nil)` = follow the Default Location; `nil` = not in the patch.
    var fixedPlace: FixedPlace??
    var radiusMi: Int?
    /// The webview's location seed (schema.md 6.4).
    var position: Coordinate?

    static let fieldNames: Set<String> = ["cadence", "quietHours", "model", "fixedPlace", "radiusMi", "position"]

    private static func number(_ v: Any?) -> Double? {
        guard let n = v as? NSNumber, CFGetTypeID(n) != CFBooleanGetTypeID() else { return nil }
        let d = n.doubleValue
        return d.isFinite ? d : nil
    }

    private static func integer(_ v: Any?) -> Int? {
        guard let d = number(v), d == d.rounded(), abs(d) < 1e9 else { return nil }
        return Int(d)
    }

    private static func bool(_ v: Any?) -> Bool? {
        guard let n = v as? NSNumber, CFGetTypeID(n) == CFBooleanGetTypeID() else { return nil }
        return n.boolValue
    }

    /// The patch in these bytes, or nil (refused whole): not a JSON object, a
    /// key outside the table, or any value outside its type or bound.
    static func parse(_ data: Data) -> AlertsSettingsPatch? {
        guard let any = try? JSONSerialization.jsonObject(with: data), let obj = any as? [String: Any],
              Set(obj.keys).isSubset(of: fieldNames) else { return nil }
        var p = AlertsSettingsPatch()
        if let v = obj["cadence"] {
            guard let s = v as? String, let c = AlertCadence(rawValue: s) else { return nil }
            p.cadence = c
        }
        if let v = obj["quietHours"] {
            guard let q = v as? [String: Any], Set(q.keys) == QuietHoursSetting.fieldNames,
                  let on = bool(q["on"]), let s = integer(q["startMin"]), let e = integer(q["endMin"]) else { return nil }
            let qh = QuietHoursSetting(on: on, startMin: s, endMin: e)
            guard qh.isValid else { return nil }
            p.quietHours = qh
        }
        if let v = obj["model"] {
            guard let s = v as? String, let m = AlertModel(rawValue: s) else { return nil }
            p.model = m
        }
        if let v = obj["fixedPlace"] {
            if v is NSNull {
                p.fixedPlace = .some(nil)
            } else {
                guard let f = v as? [String: Any], Set(f.keys).isSubset(of: FixedPlace.fieldNames),
                      let lat = number(f["lat"]), let lng = number(f["lng"]) else { return nil }
                var name: String? = nil
                if let n = f["name"], !(n is NSNull) {
                    guard let s = n as? String else { return nil }
                    name = s
                }
                let place = FixedPlace(lat: lat, lng: lng, name: name)
                guard place.isValid else { return nil }
                p.fixedPlace = .some(place)
            }
        }
        if let v = obj["radiusMi"] {
            guard let r = integer(v), AlertValidate.radius(r) else { return nil }
            p.radiusMi = r
        }
        if let v = obj["position"] {
            guard let pos = v as? [String: Any], Set(pos.keys) == ["lat", "lng"],
                  let lat = number(pos["lat"]), let lng = number(pos["lng"]),
                  AlertValidate.lat(lat), AlertValidate.lng(lng) else { return nil }
            p.position = Coordinate(lat: lat, lng: lng)
        }
        return p
    }

    /// The settings with this patch applied (the position is applied to the
    /// state, by the engine).
    func applied(to s: AlertsSettings, now: Date) -> AlertsSettings {
        var out = s
        if let c = cadence { out.cadence = c }
        if let q = quietHours { out.quietHours = q }
        if let m = model { out.model = m }
        if let f = fixedPlace { out.fixedPlace = f }
        if let r = radiusMi { out.radiusMi = r }
        out.updatedAt = WidgetTime.string(now)
        return out
    }
}
