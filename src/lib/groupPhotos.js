const ORDER_UNSET = 999

export function sortByRecency(a, b) {
  return (b[0]?.time ?? 0) - (a[0]?.time ?? 0)
}

// Shared /api/photos & /api/search-catches row shape → in-app photo object.
// Callers spread in any endpoint-specific extras (id, isOwn, ownerProfile, ...).
export function mapPhotoRow(row) {
  return {
    name: row.filename,
    userId: row.user_id,
    catchId: row.catch_id ?? null,
    url: row.url,
    time: row.time ? new Date(row.time).getTime() : null,
    hasGps: row.lat != null && row.lng != null,
    exif: row.lat != null && row.lng != null ? { latitude: row.lat, longitude: row.lng } : null,
    species: row.species || undefined,
    meta: row.meta || {},
  }
}

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

  return [...catchGroups, ...ungrouped].sort(sortByRecency)
}
