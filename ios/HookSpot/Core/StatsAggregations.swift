import Foundation

// Data shaping from src/stats.js (renderStats), minus ApexCharts — fed to Swift Charts.

nonisolated struct CountEntry: Hashable, Sendable, Identifiable {
    let label: String
    let count: Int
    var id: String { label }
}

nonisolated struct MonthCount: Hashable, Sendable, Identifiable {
    let monthStart: Date
    let count: Int
    var id: Date { monthStart }
}

nonisolated struct SpeciesMonthSeries: Hashable, Sendable, Identifiable {
    let species: String
    let counts: [MonthCount]
    var id: String { species }
}

nonisolated struct CatchStats: Sendable {
    var totalCatches = 0
    var monthly: [MonthCount] = []          // last 12 months, oldest first
    var hourly: [Int] = Array(repeating: 0, count: 24)
    var species: [CountEntry] = []          // desc by count
    var speciesMonthly: [SpeciesMonthSeries] = [] // top 5 species × 12 months
    var rods: [CountEntry] = []
    var flies: [CountEntry] = []
    var weatherConditions: [CountEntry] = []
    var temperatureBuckets: [CountEntry] = [] // "60–69°", ascending

    static let hourLabels: [String] = (0..<24).map { i in
        i == 0 ? "12a" : i < 12 ? "\(i)a" : i == 12 ? "12p" : "\(i - 12)p"
    }

    var totalLabel: String { "\(totalCatches) catch\(totalCatches != 1 ? "es" : "")" }
}

nonisolated enum StatsAggregations {
    static func compute(_ groups: [PhotoGroup], now: Date = .now, calendar: Calendar = .current) -> CatchStats {
        var stats = CatchStats()
        stats.totalCatches = groups.count
        guard !groups.isEmpty else { return stats }

        let leads = groups.compactMap(\.lead)
        let leadsWithTime = leads.filter { $0.time != nil }
        let thisMonth = calendar.date(from: calendar.dateComponents([.year, .month], from: now))!
        let months: [Date] = (0..<12).reversed().map { calendar.date(byAdding: .month, value: -$0, to: thisMonth)! }

        func monthIndex(_ d: Date) -> Int? {
            let a = calendar.dateComponents([.year, .month], from: d)
            let b = calendar.dateComponents([.year, .month], from: now)
            let diff = (b.year! - a.year!) * 12 + (b.month! - a.month!)
            return (0..<12).contains(diff) ? 11 - diff : nil
        }

        var mCounts = Array(repeating: 0, count: 12)
        for p in leadsWithTime { if let i = monthIndex(p.time!) { mCounts[i] += 1 } }
        stats.monthly = zip(months, mCounts).map { MonthCount(monthStart: $0, count: $1) }

        for p in leadsWithTime { stats.hourly[calendar.component(.hour, from: p.time!)] += 1 }

        stats.species = countDesc(leads.compactMap { Formatters.speciesLabel($0.species) })

        stats.speciesMonthly = stats.species.prefix(5).map { sp in
            var counts = Array(repeating: 0, count: 12)
            for p in leadsWithTime where Formatters.speciesLabel(p.species) == sp.label {
                if let i = monthIndex(p.time!) { counts[i] += 1 }
            }
            return SpeciesMonthSeries(species: sp.label,
                                      counts: zip(months, counts).map { MonthCount(monthStart: $0, count: $1) })
        }

        // rod/fly live in meta on whichever photo of the catch has them; dedupe case-insensitively, first-seen casing.
        func gear(_ key: String) -> [CountEntry] {
            var order: [String] = []
            var display: [String: String] = [:]
            var counts: [String: Int] = [:]
            for g in groups {
                guard let raw = g.first(where: { ($0.meta[key]?.stringValue ?? "").isEmpty == false })?.meta[key]?.stringValue,
                      let val = Formatters.cleanGear(raw) else { continue }
                let k = val.lowercased()
                if counts[k] == nil { order.append(k); display[k] = val }
                counts[k, default: 0] += 1
            }
            return stableSorted(order.map { CountEntry(label: display[$0]!, count: counts[$0]!) }) { $0.count > $1.count }
        }
        stats.rods = gear("rod")
        stats.flies = gear("fly")

        // Weather is stored on the first photo of each catch.
        let weathers = groups.compactMap { $0.first?.weather }
        stats.weatherConditions = countDesc(weathers.map { $0.condition ?? "Unknown" })
        var buckets: [Int: Int] = [:]
        for w in weathers { if let t = w.temp { buckets[Int((t / 10).rounded(.down)) * 10, default: 0] += 1 } }
        stats.temperatureBuckets = buckets.keys.sorted().map { CountEntry(label: "\($0)–\($0 + 9)°", count: buckets[$0]!) }
        return stats
    }

    /// Count occurrences, descending; ties keep first-seen order (JS object insertion + stable sort).
    static func countDesc(_ labels: [String]) -> [CountEntry] {
        var order: [String] = []
        var counts: [String: Int] = [:]
        for l in labels {
            if counts[l] == nil { order.append(l) }
            counts[l, default: 0] += 1
        }
        return stableSorted(order.map { CountEntry(label: $0, count: counts[$0]!) }) { $0.count > $1.count }
    }
}
