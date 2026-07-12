import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import { groupPhotos } from '../lib/groupPhotos'

const PAGE_SIZE = 50

function normalize(row) {
  return {
    ...row,
    catchId: row.catch_id,
    time: row.time ? new Date(row.time).getTime() : null,
  }
}

const QUERY_COLS = 'id, filename, user_id, catch_id, lat, lng, species, time, meta, storage_path, url, thumb_url'

// Feed = own photos + followed anglers' photos (same as web /api/photos).
// GPS-less catches are included; the map layer filters for coordinates itself.
function buildQuery(userIds) {
  return supabase
    .from('photos')
    .select(QUERY_COLS)
    .in('user_id', userIds)
    .order('time', { ascending: false })
}

async function fetchFeedIds(userId) {
  const { data, error } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId)
  if (error) console.error('[photoStore] follows:', error)
  return [userId, ...(data ?? []).map(f => f.following_id)].slice(0, 100)
}

// Backfill time and/or lat/lng from catches for photos missing either field
// (old data; see photos-handler.js for the full story).
async function backfillFromCatches(rows) {
  const catchIds = [...new Set(
    rows.filter(r => (!r.time || r.lat == null) && r.catch_id).map(r => r.catch_id)
  )]
  if (!catchIds.length) return rows
  const { data: catches } = await supabase
    .from('catches')
    .select('id, time, lat, lng')
    .in('id', catchIds)
  if (!catches?.length) return rows
  const catchMap = Object.fromEntries(catches.map(c => [c.id, c]))
  return rows.map(r => {
    const c = r.catch_id && catchMap[r.catch_id]
    if (!c) return r
    const patch = {}
    if (!r.time && c.time) patch.time = c.time
    if (r.lat == null && c.lat != null) { patch.lat = c.lat; patch.lng = c.lng }
    return Object.keys(patch).length ? { ...r, ...patch } : r
  })
}

async function fetchProfiles(rows, existing = {}) {
  const missing = [...new Set(rows.map(r => r.user_id))].filter(id => !existing[id])
  if (!missing.length) return existing
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url')
    .in('id', missing)
  if (error) console.error('[photoStore] profiles:', error)
  const next = { ...existing }
  for (const p of data ?? []) next[p.id] = p
  return next
}

export const usePhotoStore = create((set, get) => ({
  photos: [],
  groups: [],
  profilesById: {},
  feedIds: null,
  loading: false,
  loadingMore: false,
  hasMore: true,
  uploadOpen: false,

  async loadPhotos(userId) {
    set({ loading: true, photos: [], groups: [], hasMore: true })
    const feedIds = await fetchFeedIds(userId)
    const { data, error } = await buildQuery(feedIds).range(0, PAGE_SIZE - 1)
    if (error) console.error('[photoStore] load:', error)
    const rows = await backfillFromCatches(data ?? [])
    const profilesById = await fetchProfiles(rows, get().profilesById)
    const photos = rows.map(normalize)
    set({
      photos,
      groups: groupPhotos(photos),
      profilesById,
      feedIds,
      loading: false,
      hasMore: (data?.length ?? 0) === PAGE_SIZE,
    })
  },

  async loadMore(userId) {
    const { loadingMore, hasMore, photos, feedIds } = get()
    if (loadingMore || !hasMore) return
    set({ loadingMore: true })
    const ids = feedIds ?? await fetchFeedIds(userId)
    const { data, error } = await buildQuery(ids).range(photos.length, photos.length + PAGE_SIZE - 1)
    if (error) console.error('[photoStore] loadMore:', error)
    const rows = await backfillFromCatches(data ?? [])
    const profilesById = await fetchProfiles(rows, get().profilesById)
    const next = rows.map(normalize)
    const allPhotos = [...photos, ...next]
    set({
      photos: allPhotos,
      groups: groupPhotos(allPhotos),
      profilesById,
      loadingMore: false,
      hasMore: next.length === PAGE_SIZE,
    })
  },

  // Re-run the feed query from scratch (after follow/unfollow, pull-to-refresh)
  async refreshFeed(userId) {
    await get().loadPhotos(userId)
  },

  // Merge extra profiles fetched elsewhere (e.g. search, user pages)
  addProfiles(profiles) {
    if (!profiles?.length) return
    const profilesById = { ...get().profilesById }
    for (const p of profiles) if (p?.id) profilesById[p.id] = p
    set({ profilesById })
  },

  setUploadOpen(open) {
    set({ uploadOpen: open })
  },

  addPhoto(photo) {
    const photos = [...get().photos, photo]
    set({ photos, groups: groupPhotos(photos) })
  },

  addPhotos(newPhotos) {
    const photos = [...get().photos, ...newPhotos]
    set({ photos, groups: groupPhotos(photos) })
  },

  removePhotos(toRemove) {
    const ids = new Set(toRemove.map(p => p.id).filter(Boolean))
    const filenames = new Set(toRemove.map(p => p.filename).filter(Boolean))
    const photos = get().photos.filter(p => !(ids.has(p.id) || filenames.has(p.filename)))
    set({ photos, groups: groupPhotos(photos) })
  },

  updatePhoto(updatedPhoto) {
    const match = p =>
      updatedPhoto.id && p.id ? p.id === updatedPhoto.id
      : p.filename === updatedPhoto.filename && p.user_id === updatedPhoto.user_id
    const photos = get().photos.map(p => match(p) ? updatedPhoto : p)
    set({ photos, groups: groupPhotos(photos) })
  },

  reorderGroup(newOrderedPhotos) {
    const updated = newOrderedPhotos.map((p, i) => ({ ...p, meta: { ...p.meta, order: i } }))
    const idMap = new Map(updated.filter(p => p.id).map(p => [p.id, p]))
    const photos = get().photos.map(p => idMap.has(p.id) ? idMap.get(p.id) : p)
    set({ photos, groups: groupPhotos(photos) })
  },

  removeUserPhotos(userId) {
    const photos = get().photos.filter(p => p.user_id !== userId)
    set({ photos, groups: groupPhotos(photos) })
  },

  reset() {
    set({
      photos: [], groups: [], profilesById: {}, feedIds: null,
      loading: false, loadingMore: false, hasMore: true, uploadOpen: false,
    })
  },
}))
