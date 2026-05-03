export function cleanSpecies(s) {
  if (!s || s === 'none') return null
  return s.replace(/\s*\(.*?\)/g, '').trim()
}

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export function formatDateFull(ts) {
  const d = new Date(ts)
  if (isNaN(d.getTime())) return 'Unknown date'
  const month = d.toLocaleDateString('en-US', { month: 'long' })
  const day = ordinal(d.getDate())
  const year = d.getFullYear()
  const h = d.getHours()
  const m = String(d.getMinutes()).padStart(2, '0')
  const ampm = h >= 12 ? 'pm' : 'am'
  const h12 = h % 12 || 12
  return `${month} ${day}, ${year} • ${h12}:${m}${ampm}`
}

export function parseExifDate(dt) {
  if (!dt) return null
  const str = String(dt).replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3')
  const d = new Date(str)
  return isNaN(d) ? null : d.getTime()
}

export function formatDay(ts) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'long', day: 'numeric' })
}

