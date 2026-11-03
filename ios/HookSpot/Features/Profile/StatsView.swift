import SwiftUI
import Charts

/// Profile Stats tab — the eight src/stats.js charts in Swift Charts, same data shaping.
struct StatsView: View {
    let stats: CatchStats

    var body: some View {
        if stats.totalCatches == 0 {
            Text("No catch data yet.").font(Typography.caption).foregroundStyle(Theme.darkMuted).padding(.top, 30)
        } else {
            LazyVStack(spacing: 14) {
                card("Catches per Month") {
                    Chart(stats.monthly) {
                        BarMark(x: .value("Month", $0.monthStart, unit: .month), y: .value("Catches", $0.count))
                            .foregroundStyle(Theme.chartBlues[0]).cornerRadius(4)
                    }
                    .chartXAxis { AxisMarks(values: .stride(by: .month, count: 2)) { _ in AxisValueLabel(format: .dateTime.month(.abbreviated)) } }
                    .frame(height: 200)
                }
                card("Time of Day") {
                    Chart(Array(stats.hourly.enumerated()), id: \.offset) { hour, count in
                        BarMark(x: .value("Hour", CatchStats.hourLabels[hour]), y: .value("Catches", count))
                            .foregroundStyle(Theme.chartBlues[0]).cornerRadius(3)
                    }
                    .chartXAxis { AxisMarks(values: stride(from: 0, to: 24, by: 6).map { CatchStats.hourLabels[$0] }) }
                    .frame(height: 180)
                }
                if !stats.species.isEmpty {
                    card("Species") {
                        Chart(Array(stats.species.enumerated()), id: \.element.label) { i, e in
                            SectorMark(angle: .value("Catches", e.count), innerRadius: .ratio(0.62), angularInset: 1.5)
                                .foregroundStyle(by: .value("Species", e.label))
                        }
                        .chartForegroundStyleScale(range: Theme.chartBlues)
                        .chartBackground { _ in
                            VStack(spacing: 0) {
                                Text("\(stats.species.count)").font(Typography.title)
                                Text("Species").font(Typography.cardAngler).foregroundStyle(Theme.darkMuted)
                            }
                        }
                        .frame(height: 260)
                    }
                    card("Species by Month") {
                        Chart {
                            ForEach(stats.speciesMonthly) { series in
                                ForEach(series.counts) { m in
                                    BarMark(x: .value("Month", m.monthStart, unit: .month), y: .value("Catches", m.count))
                                        .foregroundStyle(by: .value("Species", series.species))
                                }
                            }
                        }
                        .chartForegroundStyleScale(range: Theme.chartBlues)
                        .chartXAxis { AxisMarks(values: .stride(by: .month, count: 2)) { _ in AxisValueLabel(format: .dateTime.month(.abbreviated)) } }
                        .frame(height: 260)
                    }
                }
                if !stats.rods.isEmpty { card("Catches by Rod") { horizontal(stats.rods, color: Theme.chartBlues[1]) } }
                if !stats.flies.isEmpty { card("Catches by Fly") { horizontal(stats.flies, color: Theme.chartBlues[1]) } }
                if !stats.weatherConditions.isEmpty {
                    card("Catches by Condition") { vertical(stats.weatherConditions, color: Theme.chartBlues[0]) }
                    card("Catches by Temp") { vertical(stats.temperatureBuckets, color: Theme.chartBlues[2]) }
                }
            }
            .chartLegend(position: .bottom)
        }
    }

    private func horizontal(_ entries: [CountEntry], color: Color) -> some View {
        Chart(entries) {
            BarMark(x: .value("Catches", $0.count), y: .value("Name", $0.label))
                .foregroundStyle(color).cornerRadius(4)
        }
        .frame(height: max(120, CGFloat(entries.count) * 34))
    }

    private func vertical(_ entries: [CountEntry], color: Color) -> some View {
        Chart(entries) {
            BarMark(x: .value("Name", $0.label), y: .value("Catches", $0.count))
                .foregroundStyle(color).cornerRadius(4)
        }
        .frame(height: 220)
    }

    private func card(_ title: String, @ViewBuilder _ chart: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title).font(Typography.label).foregroundStyle(Theme.darkMuted)
            chart()
        }
        .padding(16)
        .background(Theme.darkSurface.opacity(0.6), in: .rect(cornerRadius: 16, style: .continuous))
        .accessibilityElement(children: .contain)
    }
}
