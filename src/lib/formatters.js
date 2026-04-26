export function parseExifDate(dt) {
  if (!dt) return null
  const str = String(dt).replace(/^(\d{4}):(\d{2}):(\d{2})/, '$1-$2-$3')
  const d = new Date(str)
  return isNaN(d) ? null : d.getTime()
}

export function formatDay(ts) {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(-2)}`
}

export function formatTime(ts) {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: '2-digit', minute: '2-digit',
  })
}
