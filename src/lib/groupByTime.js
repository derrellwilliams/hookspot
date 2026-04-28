// Photos are grouped if they fall within GROUP_WINDOW_MS of the *first* photo in
// the group (not the previous one). A photo at T+4min won't join a group that
// started at T+0, even if the previous photo was at T+3:59.
const GROUP_WINDOW_MS = 3 * 60 * 1000  // 3 minutes
const ORDER_UNSET = 999                 // sentinel for photos with no explicit order

export function groupByTime(gpsPhotos) {
  if (!gpsPhotos.length) return []
  const sorted = [...gpsPhotos].sort((a, b) => (a.time ?? 0) - (b.time ?? 0))
  const groups = []

  for (const photo of sorted) {
    const last = groups[groups.length - 1]
    const firstTime = last?.[0]?.time ?? null
    if (last && firstTime !== null && photo.time !== null && photo.time - firstTime <= GROUP_WINDOW_MS) {
      last.push(photo)
    } else {
      groups.push([photo])
    }
  }

  groups.forEach(g => {
    if (g.some(p => p.meta?.order !== undefined)) {
      g.sort((a, b) => (a.meta?.order ?? ORDER_UNSET) - (b.meta?.order ?? ORDER_UNSET))
    }
  })

  return groups
}
