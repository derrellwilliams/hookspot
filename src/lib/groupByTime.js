export function groupByTime(gpsPhotos) {
  if (!gpsPhotos.length) return []
  const sorted = [...gpsPhotos].sort((a, b) => (a.time ?? 0) - (b.time ?? 0))
  const groups = []

  for (const photo of sorted) {
    const last = groups[groups.length - 1]
    const lastTime = last?.[last.length - 1]?.time ?? null
    if (last && lastTime !== null && photo.time !== null && photo.time - lastTime <= 3 * 60 * 1000) {
      last.push(photo)
    } else {
      groups.push([photo])
    }
  }

  return groups
}
