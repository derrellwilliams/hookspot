import { useMemo } from 'react'
import { View, Text, ScrollView, StyleSheet, Dimensions } from 'react-native'
import { Svg, G, Rect, Path, Text as SvgText, Line } from 'react-native-svg'

const { width: SCREEN_W } = Dimensions.get('window')
const CARD_PAD = 16
const CHART_W = SCREEN_W - CARD_PAD * 4 // card padding + outer padding

const C = {
  surface: '#2c2c2e',
  border: '#3a3a3c',
  text: '#f4f4f5',
  muted: '#8d8d8d',
  rule: 'rgba(255,255,255,0.08)',
}
const BLUES = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe']

// ── Computation ───────────────────────────────────────────────────────────────

function speciesLabel(p) {
  const s = p.species
  if (!s || s === 'none') return null
  return s.replace(/\s*\(.*?\)/g, '').trim().replace(/\b\w/g, c => c.toUpperCase())
}

function monthWindow(n = 12) {
  const now = new Date()
  const labels = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    labels.push(d.toLocaleString('default', { month: 'short' }))
  }
  return { labels, now }
}

function useStatsData(groups) {
  return useMemo(() => {
    const leads = groups.map(g => g.find(p => p.species) ?? g[0])
    const leadsWithTime = leads.filter(p => p.time)
    const { labels: mLabels, now } = monthWindow(12)

    // Monthly catches
    const mCounts = Array(12).fill(0)
    leadsWithTime.forEach(p => {
      const d = new Date(p.time)
      const diff = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
      if (diff >= 0 && diff < 12) mCounts[11 - diff]++
    })
    const monthly = mLabels.map((label, i) => ({ label, value: mCounts[i] }))

    // Time of day
    const hCounts = Array(24).fill(0)
    leadsWithTime.forEach(p => hCounts[new Date(p.time).getHours()]++)
    const hourly = Array.from({ length: 24 }, (_, i) => ({
      value: hCounts[i],
      label: i % 6 === 0
        ? (i === 0 ? '12a' : i < 12 ? `${i}a` : i === 12 ? '12p' : `${i - 12}p`)
        : '',
    }))

    // Species
    const spCounts = {}
    leads.forEach(p => {
      const s = speciesLabel(p)
      if (s) spCounts[s] = (spCounts[s] ?? 0) + 1
    })
    const species = Object.entries(spCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value], i) => ({ value, color: BLUES[i], name }))

    // Weather
    const withWeather = groups.map(g => g[0]).filter(p => p.meta?.weather)
    const condCounts = {}
    const tempCounts = {}
    withWeather.forEach(p => {
      const cond = p.meta.weather.condition ?? 'Unknown'
      condCounts[cond] = (condCounts[cond] ?? 0) + 1
      const t = p.meta.weather.temp
      if (t != null) {
        const low = Math.floor(t / 10) * 10
        const lbl = `${low}–${low + 9}°`
        tempCounts[lbl] = (tempCounts[lbl] ?? 0) + 1
      }
    })
    const weatherCond = Object.entries(condCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value }))
    const weatherTemp = Object.entries(tempCounts)
      .sort((a, b) => parseInt(a[0]) - parseInt(b[0]))
      .map(([label, value]) => ({ label, value }))

    return { monthly, hourly, species, weatherCond, weatherTemp, hasWeather: withWeather.length > 0 }
  }, [groups])
}

// ── SVG helpers ───────────────────────────────────────────────────────────────

function polar(cx, cy, r, angleDeg) {
  const rad = (angleDeg - 90) * (Math.PI / 180)
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) }
}

function donutSlice(cx, cy, outerR, innerR, startDeg, endDeg) {
  const s1 = polar(cx, cy, outerR, startDeg)
  const e1 = polar(cx, cy, outerR, endDeg)
  const s2 = polar(cx, cy, innerR, endDeg)
  const e2 = polar(cx, cy, innerR, startDeg)
  const large = endDeg - startDeg > 180 ? 1 : 0
  return [
    `M ${s1.x} ${s1.y}`,
    `A ${outerR} ${outerR} 0 ${large} 1 ${e1.x} ${e1.y}`,
    `L ${s2.x} ${s2.y}`,
    `A ${innerR} ${innerR} 0 ${large} 0 ${e2.x} ${e2.y}`,
    'Z',
  ].join(' ')
}

// ── Chart primitives ──────────────────────────────────────────────────────────

function BarChartSvg({ data, width, height = 160, color = BLUES[0] }) {
  const PAD_L = 24, PAD_B = 22, PAD_T = 6
  const cW = width - PAD_L
  const cH = height - PAD_B - PAD_T
  const n = data.length
  const max = Math.max(...data.map(d => d.value), 1)

  const barSlot = cW / n
  const barW = Math.max(barSlot * 0.55, 6)
  const barOffset = (barSlot - barW) / 2

  const sections = 4
  const yTicks = Array.from({ length: sections + 1 }, (_, i) => ({
    value: Math.round(max * i / sections),
    y: PAD_T + cH - cH * (i / sections),
  }))

  return (
    <Svg width={width} height={height}>
      {/* Grid lines + Y labels */}
      {yTicks.map(({ value, y }, i) => (
        <G key={i}>
          {i > 0 && (
            <Line x1={PAD_L} y1={y} x2={width} y2={y} stroke={C.rule} strokeDasharray="3,3" />
          )}
          <SvgText x={PAD_L - 4} y={y + 4} textAnchor="end" fill={C.muted} fontSize={9}>
            {value}
          </SvgText>
        </G>
      ))}

      {/* X axis */}
      <Line x1={PAD_L} y1={PAD_T + cH} x2={width} y2={PAD_T + cH} stroke={C.border} />

      {/* Bars + X labels */}
      {data.map(({ value, label }, i) => {
        const barH = Math.max((value / max) * cH, value > 0 ? 2 : 0)
        const x = PAD_L + i * barSlot + barOffset
        const y = PAD_T + cH - barH
        return (
          <G key={i}>
            <Rect x={x} y={y} width={barW} height={barH} fill={color} rx={2} />
            {label ? (
              <SvgText
                x={PAD_L + i * barSlot + barSlot / 2}
                y={height - 4}
                textAnchor="middle"
                fill={C.muted}
                fontSize={9}
              >
                {label}
              </SvgText>
            ) : null}
          </G>
        )
      })}
    </Svg>
  )
}

function DonutChart({ data, radius = 84, innerRadius = 52, size = 180, totalLabel }) {
  const cx = size / 2
  const cy = size / 2
  const total = data.reduce((s, d) => s + d.value, 0)
  if (!total) return null

  let angle = 0
  const slices = data.map(({ value, color }) => {
    const sweep = (value / total) * 358 // 358 leaves a tiny gap seam
    const slice = { d: donutSlice(cx, cy, radius, innerRadius, angle, angle + sweep), color }
    angle += sweep + (358 / total > 2 ? 2 : 0.5) // gap between slices
    return slice
  })

  return (
    <Svg width={size} height={size}>
      {slices.map((s, i) => <Path key={i} d={s.d} fill={s.color} />)}
      <SvgText x={cx} y={cy - 6} textAnchor="middle" fill={C.text} fontSize={20} fontWeight="700">
        {total}
      </SvgText>
      <SvgText x={cx} y={cy + 12} textAnchor="middle" fill={C.muted} fontSize={11}>
        {totalLabel ?? 'total'}
      </SvgText>
    </Svg>
  )
}

// ── Card wrapper ──────────────────────────────────────────────────────────────

function ChartCard({ title, children }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      {children}
    </View>
  )
}

// ── Main export ───────────────────────────────────────────────────────────────

export function StatsCharts({ groups }) {
  const { monthly, hourly, species, weatherCond, weatherTemp, hasWeather } = useStatsData(groups)

  if (!groups.length) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>No catches yet — start logging!</Text>
      </View>
    )
  }

  // Hourly chart is wider than screen — needs horizontal scroll
  const HOURLY_BAR_SLOT = 20
  const hourlyChartW = 24 * HOURLY_BAR_SLOT + 32

  return (
    <View style={styles.container}>
      <ChartCard title="Catches per Month">
        <BarChartSvg data={monthly} width={CHART_W} />
      </ChartCard>

      <ChartCard title="Time of Day">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <BarChartSvg data={hourly} width={hourlyChartW} />
        </ScrollView>
      </ChartCard>

      {species.length > 0 && (
        <ChartCard title="Species">
          <View style={styles.donutRow}>
            <DonutChart data={species} />
            <View style={styles.legend}>
              {species.map(({ name, color, value }) => (
                <View key={name} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: color }]} />
                  <Text style={styles.legendLabel} numberOfLines={1}>{name}</Text>
                  <Text style={styles.legendValue}>{value}</Text>
                </View>
              ))}
            </View>
          </View>
        </ChartCard>
      )}

      {hasWeather && weatherCond.length > 0 && (
        <ChartCard title="Catches by Condition">
          <BarChartSvg data={weatherCond} width={CHART_W} color={BLUES[1]} />
        </ChartCard>
      )}

      {hasWeather && weatherTemp.length > 0 && (
        <ChartCard title="Catches by Temperature">
          <BarChartSvg data={weatherTemp} width={CHART_W} color={BLUES[2]} />
        </ChartCard>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { paddingBottom: 0 },
  card: {
    backgroundColor: C.surface,
    borderRadius: 12,
    padding: CARD_PAD,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: C.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },

  // Donut
  donutRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  legend: { flex: 1, gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  legendLabel: { flex: 1, color: C.text, fontSize: 13 },
  legendValue: { color: C.muted, fontSize: 13 },

  // Empty
  empty: { alignItems: 'center', paddingVertical: 32 },
  emptyText: { color: C.muted, fontSize: 14 },
})
