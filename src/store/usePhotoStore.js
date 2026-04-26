import { create } from 'zustand'
import { groupByTime } from '../lib/groupByTime.js'

export const usePhotoStore = create((set, get) => ({
  photos: [],
  groups: [],
  flyToPhoto: null,
  activeGroup: null,
  toast: null,
  uploadOpen: false,

  addPhoto(photo) {
    const photos = [...get().photos, photo]
    set({ photos, groups: groupByTime(photos.filter(p => p.hasGps)) })
  },

  updatePhoto(updatedPhoto) {
    const photos = get().photos.map(p => p.name === updatedPhoto.name ? updatedPhoto : p)
    set({ photos, groups: groupByTime(photos.filter(p => p.hasGps)) })
  },

  removePhotos(toDelete) {
    const deleteSet = new Set(Array.isArray(toDelete) ? toDelete : [toDelete])
    const removed = get().photos.filter(p => deleteSet.has(p))
    removed.forEach(p => { if (p.url?.startsWith('blob:')) URL.revokeObjectURL(p.url) })
    const photos = get().photos.filter(p => !deleteSet.has(p))
    set({ photos, groups: groupByTime(photos.filter(p => p.hasGps)), activeGroup: null })
  },

  setFlyToPhoto(fn) {
    set({ flyToPhoto: fn })
  },

  setActiveGroup(group) {
    set({ activeGroup: group })
  },

  showToast(msg) {
    set({ toast: msg })
    setTimeout(() => set(s => s.toast === msg ? { toast: null } : {}), 3200)
  },

  setUploadOpen(open) {
    set({ uploadOpen: open })
  },
}))
