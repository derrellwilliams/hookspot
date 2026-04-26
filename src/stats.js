import ApexCharts from 'apexcharts'

let charts = []

function destroyAll() {
  charts.forEach(c => c.destroy())
  charts = []
}

const BASE_CHART = {
  background: 'transparent',
  foreColor: '#a1a1aa',
  toolbar: { show: false },
  fontFamily: 'Roboto, sans-serif',
  animations: { speed: 450, animateGradually: { enabled: false } },
}

const BASE = {
  theme: { mode: 'dark' },
  grid: { borderColor: '#3a3a3c', strokeDashArray: 4 },
  tooltip: { theme: 'dark' },
  xaxis: {
    labels: { style: { colors: '#71717a', fontSize: '11px' } },
    axisBorder: { color: '#3a3a3c' },
    axisTicks: { color: '#3a3a3c' },
  },
  yaxis: { labels: { style: { colors: '#71717a', fontSize: '11px' } } },
  dataLabels: { enabled: false },
}

const BLUES = ['#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe']

function make(el, opts) {
  if (!el) return
  const chart = new ApexCharts(el, opts)
  charts.push(chart)
  chart.render()
}

function toTitleCase(str) {
  return str.replace(/\b\w/g, c => c.toUpperCase())
}

function speciesLabel(p) {
  return p.species && p.species !== 'none'
    ? toTitleCase(p.species.replace(/\s*\(.*?\)/g, '').trim())
    : null
}

function monthWindow(n = 12) {
  const now = new Date()
  const labels = []
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    labels.push(d.toLocaleString('default', { month: 'short', year: '2-digit' }))
  }
  return { labels, now }
}

export function renderStats(groups, refs = {}) {
  destroyAll()

  const photos = groups.flat()
  // One lead per group — same logic as the sidebar
  const leads = groups.map(g => g.find(p => p.species) ?? g[0])

  const totalEl = refs.total ?? document.getElementById('stats-total')
  if (totalEl) totalEl.textContent = `${groups.length} catch${groups.length !== 1 ? 'es' : ''}`

  if (!groups.length) return

  const withTime = photos.filter(p => p.time)
  const { labels: mLabels, now } = monthWindow(12)

  // ── Catches per month ──────────────────────────────────────────────────────
  const mCounts = Array(12).fill(0)
  withTime.forEach(p => {
    const d = new Date(p.time)
    const diff = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
    if (diff >= 0 && diff < 12) mCounts[11 - diff]++
  })

  make(refs.monthly ?? document.getElementById('chart-monthly'), {
    ...BASE,
    chart: { ...BASE_CHART, type: 'bar', height: 200 },
    series: [{ name: 'Catches', data: mCounts }],
    xaxis: { ...BASE.xaxis, categories: mLabels },
    colors: [BLUES[0]],
    plotOptions: { bar: { borderRadius: 4, columnWidth: '52%' } },
  })

  // ── Time of day ────────────────────────────────────────────────────────────
  const hCounts = Array(24).fill(0)
  withTime.forEach(p => hCounts[new Date(p.time).getHours()]++)
  const hLabels = Array.from({ length: 24 }, (_, i) =>
    i === 0 ? '12a' : i < 12 ? `${i}a` : i === 12 ? '12p' : `${i - 12}p`
  )

  make(refs.hourly ?? document.getElementById('chart-hourly'), {
    ...BASE,
    chart: { ...BASE_CHART, type: 'bar', height: 180 },
    series: [{ name: 'Catches', data: hCounts }],
    xaxis: { ...BASE.xaxis, categories: hLabels, labels: { ...BASE.xaxis.labels, rotate: 0 } },
    colors: [BLUES[0]],
    plotOptions: { bar: { borderRadius: 3, columnWidth: '65%' } },
  })

  // ── Species breakdown (donut) ──────────────────────────────────────────────
  const spCounts = {}
  leads.forEach(p => {
    const s = speciesLabel(p)
    if (!s) return
    spCounts[s] = (spCounts[s] ?? 0) + 1
  })
  const spEntries = Object.entries(spCounts).sort((a, b) => b[1] - a[1])

  make(refs.species ?? document.getElementById('chart-species'), {
    ...BASE,
    chart: { ...BASE_CHART, type: 'donut', height: 260 },
    series: spEntries.map(([, v]) => v),
    labels: spEntries.map(([k]) => k),
    colors: BLUES,
    legend: {
      position: 'bottom',
      labels: { colors: '#a1a1aa' },
      fontSize: '12px',
      fontFamily: 'Roboto, sans-serif',
    },
    stroke: { colors: ['#1c1c1e'], width: 2 },
    plotOptions: {
      pie: {
        donut: {
          size: '62%',
          labels: {
            show: true,
            total: { show: true, label: 'Total', color: '#a1a1aa', fontFamily: 'Roboto, sans-serif' },
          },
        },
      },
    },
  })

  // ── Species by month (stacked bar) ────────────────────────────────────────
  const leadsWithTime = leads.filter(p => p.time)
  const topSp = spEntries.slice(0, 5).map(([k]) => k)
  const spMonthly = topSp.map(sp => ({
    name: sp,
    data: Array.from({ length: 12 }, (_, idx) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - idx), 1)
      return leadsWithTime.filter(p => {
        const pd = new Date(p.time)
        return (
          pd.getFullYear() === d.getFullYear() &&
          pd.getMonth() === d.getMonth() &&
          speciesLabel(p) === sp
        )
      }).length
    }),
  }))

  make(refs.speciesMonthly ?? document.getElementById('chart-species-monthly'), {
    ...BASE,
    chart: { ...BASE_CHART, type: 'bar', stacked: true, height: 260 },
    series: spMonthly,
    xaxis: { ...BASE.xaxis, categories: mLabels },
    colors: BLUES,
    plotOptions: { bar: { borderRadius: 3, columnWidth: '52%' } },
    legend: {
      labels: { colors: '#a1a1aa' },
      fontSize: '12px',
      fontFamily: 'Roboto, sans-serif',
    },
  })
}
