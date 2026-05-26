import { groupByTime } from './groupByTime.js'

const ORDER_UNSET = 999

// Groups photos by catch_id (new catches) with groupByTime as fallback for
// legacy photos that pre-date the catches table (catch_id === null).
// Caller is responsible for pre-filtering by hasGps if needed (same contract as groupByTime).
export function groupPhotos(photos) {
  const byCatchId = {}
  const legacy = []

  for (const p of photos) {
    if (p.catchId) {
      (byCatchId[p.catchId] ??= []).push(p)
    } else {
      legacy.push(p)
    }
  }

  const catchGroups = Object.values(byCatchId).map(g =>
    g.sort((a, b) =>
      (a.meta?.order ?? ORDER_UNSET) - (b.meta?.order ?? ORDER_UNSET) ||
      (a.time ?? 0) - (b.time ?? 0)
    )
  )

  const legacyGroups = groupByTime(legacy)

  return [...catchGroups, ...legacyGroups]
    .sort((a, b) => (b[0]?.time ?? 0) - (a[0]?.time ?? 0))
}
