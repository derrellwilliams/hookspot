import Foundation

// Port of src/lib/formatters.js. Dates format in the device time zone, like the
// web's local-time Date methods; `calendar` is injectable so tests stay deterministic.

enum Formatters {
    static func formatLocation(city: String?, state: String?) -> String? {
        guard let city, !city.isEmpty, let state, !state.isEmpty else { return nil }
        return "\(city), \(state)"
    }

    static func formatCatchLocation(_ photo: Photo) -> String? {
        let loc = photo.location
        guard let wb = photo.waterBodyName, !wb.isEmpty else {
            return formatLocation(city: loc?.city, state: loc?.state)
        }
        if let state = loc?.state, !state.isEmpty { return "\(wb), \(state)" }
        return wb
    }

    static func displayName(_ p: ProfileSummary?) -> String {
        [p?.displayName, p?.username].compactMap { $0 }.first { !$0.isEmpty } ?? ""
    }

    static func cleanSpecies(_ s: String?) -> String? {
        guard let s, !s.isEmpty, s != "none" else { return nil }
        return s.replacing(/\s*\(.*?\)/, with: "").trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Collapse stray/doubled/non-breaking whitespace so gear names don't duplicate.
    static func cleanGear(_ s: String?) -> String? {
        guard let s else { return nil }
        let t = s.replacing(/\s+/, with: " ").trimmingCharacters(in: .whitespacesAndNewlines)
        return t.isEmpty ? nil : t
    }

    /// Canonical species label for counting/charting (title-cased word starts, as `\b\w` on web).
    static func speciesLabel(_ species: String?) -> String? {
        guard let s = cleanSpecies(species), !s.isEmpty else { return nil }
        var out = ""
        var prevIsWord = false
        for ch in s {
            let isWord = ch.isASCII && (ch.isLetter || ch.isNumber || ch == "_")
            out.append(isWord && !prevIsWord ? Character(ch.uppercased()) : ch)
            prevIsWord = isWord
        }
        return out
    }

    static func ordinal(_ n: Int) -> String {
        let v = n % 100
        if v >= 20 {
            switch (v - 20) % 10 { case 1: return "\(n)st"; case 2: return "\(n)nd"; case 3: return "\(n)rd"; default: return "\(n)th" }
        }
        switch v { case 1: return "\(n)st"; case 2: return "\(n)nd"; case 3: return "\(n)rd"; default: return "\(n)th" }
    }

    private static func parts(_ d: Date, _ cal: Calendar) -> (month: String, day: Int, year: Int, mm: Int, time: String) {
        let c = cal.dateComponents([.year, .month, .day, .hour, .minute], from: d)
        let monthName = DateFormatter.enUSMonthNames[(c.month ?? 1) - 1]
        let h = c.hour ?? 0
        let time = "\(h % 12 == 0 ? 12 : h % 12):\(String(format: "%02d", c.minute ?? 0))\(h >= 12 ? "pm" : "am")"
        return (monthName, c.day ?? 1, c.year ?? 1970, c.month ?? 1, time)
    }

    static func formatDateShort(_ d: Date?, hideTime: Bool = false, calendar: Calendar = .current) -> String? {
        guard let d else { return nil }
        let p = parts(d, calendar)
        let base = "\(p.month) \(ordinal(p.day))"
        return hideTime ? base : "\(base) · \(p.time)"
    }

    static func formatDateFull(_ d: Date?, hideTime: Bool = false, calendar: Calendar = .current) -> String {
        guard let d else { return "Unknown date" }
        let p = parts(d, calendar)
        let base = "\(p.month) \(ordinal(p.day)), \(p.year)"
        return hideTime ? base : "\(base) · \(p.time)"
    }

    static func formatDateNumeric(_ d: Date?, hideTime: Bool = false, calendar: Calendar = .current) -> String {
        guard let d else { return "Unknown date" }
        let p = parts(d, calendar)
        let base = String(format: "%02d/%02d/%02d", p.mm, p.day, p.year % 100)
        return hideTime ? base : "\(base) · \(p.time)"
    }

    /// `formatDay` — locale-aware "October 30".
    static func formatDay(_ d: Date) -> String {
        d.formatted(.dateTime.month(.wide).day())
    }
}

private extension DateFormatter {
    static let enUSMonthNames: [String] = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US")
        return f.standaloneMonthSymbols
    }()
}

enum DateParsing {
    /// Supabase `timestamptz` / JS ISO strings, with or without fractional seconds.
    static func timestamptz(_ s: String) -> Date? {
        if let d = try? Date(s, strategy: .iso8601) { return d }
        let frac = Date.ISO8601FormatStyle(includingFractionalSeconds: true)
        if let d = try? frac.parse(s) { return d }
        // Postgres sometimes returns "2024-05-01 12:00:00+00" (space separator, short offset)
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        for fmt in ["yyyy-MM-dd HH:mm:ssXXXXX", "yyyy-MM-dd HH:mm:ss.SSSSSSXXXXX", "yyyy-MM-dd HH:mm:ssX", "yyyy-MM-dd'T'HH:mm:ss.SSSSSSXXXXX"] {
            f.dateFormat = fmt
            if let d = f.date(from: s) { return d }
        }
        return nil
    }

    /// `parseExifDate` — EXIF "2024:03:15 10:00:00" (local time, no zone) → Date.
    static func exif(_ s: String?, timeZone: TimeZone = .current) -> Date? {
        guard let s, !s.isEmpty else { return nil }
        let normalized = s.replacing(/^(\d{4}):(\d{2}):(\d{2})/) { "\($0.1)-\($0.2)-\($0.3)" }
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = timeZone
        for fmt in ["yyyy-MM-dd HH:mm:ss", "yyyy-MM-dd'T'HH:mm:ss", "yyyy-MM-dd"] {
            f.dateFormat = fmt
            if let d = f.date(from: normalized) { return d }
        }
        return timestamptz(normalized)
    }

    /// JS `Date.toISOString()` (UTC, milliseconds) — the format the web writes to `time` columns.
    static func isoString(_ d: Date) -> String {
        isoFormatter.string(from: d)
    }

    nonisolated(unsafe) private static let isoFormatter: ISO8601DateFormatter = {
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        f.timeZone = TimeZone(identifier: "UTC")
        return f
    }()
}
