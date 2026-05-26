const ORDER_UNSET = 999

export function groupPhotos(photos) {
  const byCatchId = {}
  const ungrouped = []

  for (const p of photos) {
    if (p.catchId) {
      (byCatchId[p.catchId] ??= []).push(p)
    } else {
      ungrouped.push([p])
    }
  }

  const catchGroups = Object.values(byCatchId).map(g =>
    g.sort((a, b) =>
      (a.meta?.order ?? ORDER_UNSET) - (b.meta?.order ?? ORDER_UNSET) ||
      (a.time ?? 0) - (b.time ?? 0)
    )
  )

  return [...catchGroups, ...ungrouped]
    .sort((a, b) => (b[0]?.time ?? 0) - (a[0]?.time ?? 0))
}
