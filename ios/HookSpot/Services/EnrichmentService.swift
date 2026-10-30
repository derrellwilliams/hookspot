import Foundation

/// Port of src/lib/geocode.js, waterbody.js and weather.js. Returns values in the
/// exact `meta` shapes the web writes, so data stays identical across clients.
struct EnrichmentService: Sendable {
    var mapboxToken: String = AppConfig.mapboxPublicToken
    var session: URLSession = .shared

    private func json(_ url: URL) async -> [String: Any]? {
        guard let (data, res) = try? await session.data(from: url),
              (res as? HTTPURLResponse)?.statusCode == 200 else { return nil }
        return try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    }

    /// → meta.location `{ city, state }`
    func reverseGeocode(_ c: Coordinate) async -> JSONValue? {
        guard !mapboxToken.isEmpty,
              let url = URL(string: "https://api.mapbox.com/geocoding/v5/mapbox.places/\(c.longitude),\(c.latitude).json?types=place,region&limit=1&access_token=\(mapboxToken)"),
              let f = (await json(url))?["features"] as? [[String: Any]], let first = f.first else { return nil }
        let city = first["text"] as? String
        let state = (first["context"] as? [[String: Any]])?
            .first { ($0["id"] as? String)?.hasPrefix("region.") == true }?["text"] as? String
        return .object(["city": city.map(JSONValue.string) ?? .null, "state": state.map(JSONValue.string) ?? .null])
    }

    private static let waterClasses: Set<String> = ["water", "stream", "river", "canal", "reservoir"]

    private func waterQuery(_ c: Coordinate, radius: Int) async -> JSONValue? {
        guard let url = URL(string: "https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/tilequery/\(c.longitude),\(c.latitude).json?radius=\(radius)&limit=50&layers=natural_label&access_token=\(mapboxToken)"),
              let features = (await json(url))?["features"] as? [[String: Any]] else { return nil }
        let best = features
            .compactMap { $0["properties"] as? [String: Any] }
            .filter { ($0["name"] as? String).map { !$0.isEmpty } == true && Self.waterClasses.contains($0["class"] as? String ?? "") }
            .min { dist($0) < dist($1) }
        guard let best, let name = best["name"] as? String, let cls = best["class"] as? String else { return nil }
        return .object(["name": .string(name), "class": .string(cls)])
    }

    private func dist(_ p: [String: Any]) -> Double {
        ((p["tilequery"] as? [String: Any])?["distance"] as? Double) ?? .infinity
    }

    /// → meta.waterBody `{ name, class }` — nearest named water within 800 m, then 8 km.
    func nearestWaterBody(_ c: Coordinate) async -> JSONValue? {
        guard !mapboxToken.isEmpty else { return nil }
        if let near = await waterQuery(c, radius: 800) { return near }
        return await waterQuery(c, radius: 8000)
    }

    static let wmo: [Int: String] = [
        0: "Clear", 1: "Mostly clear", 2: "Partly cloudy", 3: "Overcast",
        45: "Foggy", 48: "Foggy",
        51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
        61: "Light rain", 63: "Rain", 65: "Heavy rain",
        71: "Light snow", 73: "Snow", 75: "Heavy snow",
        80: "Showers", 81: "Showers", 82: "Heavy showers",
        85: "Snow showers", 86: "Heavy snow showers",
        95: "Thunderstorm", 96: "Thunderstorm", 99: "Thunderstorm",
    ]

    /// The hourly slot weather.js looks up. Mirrors the web exactly: the *UTC* date
    /// (toISOString) combined with the *device-local* hour (getHours).
    static func weatherTarget(for date: Date, localCalendar: Calendar = .current) -> (dateStr: String, target: String) {
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = TimeZone(identifier: "UTC")!
        let d = utc.dateComponents([.year, .month, .day], from: date)
        let dateStr = String(format: "%04d-%02d-%02d", d.year!, d.month!, d.day!)
        return (dateStr, "\(dateStr)T\(String(format: "%02d", localCalendar.component(.hour, from: date))):00")
    }

    /// → meta.weather `{ temp, condition }` (°F) from Open-Meteo.
    func weather(_ c: Coordinate, at date: Date, now: Date = .now) async -> JSONValue? {
        let (dateStr, target) = Self.weatherTarget(for: date)
        let daysAgo = now.timeIntervalSince(date) / 86400
        var comps: URLComponents
        var q: [URLQueryItem] = [
            .init(name: "latitude", value: String(format: "%.4f", c.latitude)),
            .init(name: "longitude", value: String(format: "%.4f", c.longitude)),
        ]
        if daysAgo <= 90 {
            comps = URLComponents(string: "https://api.open-meteo.com/v1/forecast")!
            q += [.init(name: "hourly", value: "temperature_2m,weather_code"), .init(name: "timezone", value: "auto"),
                  .init(name: "temperature_unit", value: "fahrenheit"),
                  .init(name: "past_days", value: String(min(92, Int(daysAgo.rounded(.up)) + 1))),
                  .init(name: "forecast_days", value: "1")]
        } else {
            comps = URLComponents(string: "https://archive-api.open-meteo.com/v1/archive")!
            q += [.init(name: "start_date", value: dateStr), .init(name: "end_date", value: dateStr),
                  .init(name: "hourly", value: "temperature_2m,weather_code"), .init(name: "timezone", value: "auto"),
                  .init(name: "temperature_unit", value: "fahrenheit")]
        }
        comps.queryItems = q
        guard let url = comps.url, let hourly = (await json(url))?["hourly"] as? [String: Any],
              let temps = (hourly["temperature_2m"] as? [Any])?.map({ $0 as? Double }),
              let codes = (hourly["weather_code"] as? [Any])?.map({ $0 as? Int }),
              let times = hourly["time"] as? [String], let idx = times.firstIndex(of: target),
              idx < temps.count, idx < codes.count, let temp = temps[idx] else { return nil }
        let condition = codes[idx].flatMap { Self.wmo[$0] }
        return .object(["temp": .number((temp + 0.5).rounded(.down)) /* JS Math.round */, "condition": condition.map(JSONValue.string) ?? .null])
    }
}

/// Limits concurrent enrichment calls (makeSemaphore(3) on web).
actor AsyncLimiter {
    private let limit: Int
    private var active = 0
    private var waiters: [CheckedContinuation<Void, Never>] = []

    init(limit: Int) { self.limit = limit }

    func run<T: Sendable>(_ work: @Sendable () async -> T) async -> T {
        if active >= limit { await withCheckedContinuation { waiters.append($0) } } else { active += 1 }
        defer {
            if waiters.isEmpty { active -= 1 } else { waiters.removeFirst().resume() }
        }
        return await work()
    }
}
