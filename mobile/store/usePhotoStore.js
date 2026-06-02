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

const QUERY_COLS = 'id, filename, user_id, catch_id, lat, lng, species, time, meta, storage_path'

function buildQuery(userId) {
  return supabase
    .from('photos')
    .select(QUERY_COLS)
    .eq('user_id', userId)
    .not('lat', 'is', null)
    .not('lng', 'is', null)
    .order('time', { ascending: false })
}

export const usePhotoStore = create((set, get) => ({
  photos: [],
  groups: [],
  loading: false,
  loadingMore: false,
  hasMore: true,
  uploadOpen: false,

  async loadPhotos(userId) {
    set({ loading: true, photos: [], groups: [], hasMore: true })
    const { data, error } = await buildQuery(userId).range(0, PAGE_SIZE - 1)
    if (error) console.error('[photoStore] load:', error)
    const photos = (data ?? []).map(normalize)
    set({
      photos,
      groups: groupPhotos(photos),
      loading: false,
      hasMore: (data?.length ?? 0) === PAGE_SIZE,
    })
  },

  async loadMore(userId) {
    const { loadingMore, hasMore, photos } = get()
    if (loadingMore || !hasMore) return
    set({ loadingMore: true })
    const { data, error } = await buildQuery(userId).range(photos.length, photos.length + PAGE_SIZE - 1)
    if (error) console.error('[photoStore] loadMore:', error)
    const next = (data ?? []).map(normalize)
    const allPhotos = [...photos, ...next]
    set({
      photos: allPhotos,
      groups: groupPhotos(allPhotos),
      loadingMore: false,
      hasMore: next.length === PAGE_SIZE,
    })
  },

  setUploadOpen(open) {
    set({ uploadOpen: open })
  },

  addPhoto(photo) {
    const photos = [...get().photos, photo]
    set({ photos, groups: groupPhotos(photos) })
  },

  removePhotos(toRemove) {
    const ids = new Set(toRemove.map(p => p.id).filter(Boolean))
    const filenames = new Set(toRemove.map(p => p.filename).filter(Boolean))
    const photos = get().photos.filter(p => !(ids.has(p.id) || filenames.has(p.filename)))
    set({ photos, groups: groupPhotos(photos) })
  },

  reset() {
    set({ photos: [], groups: [], loading: false, loadingMore: false, hasMore: true, uploadOpen: false })
  },
}))
