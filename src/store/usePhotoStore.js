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
    const nameSet = new Set((Array.isArray(toDelete) ? toDelete : [toDelete]).map(p => p.name))
    const removed = get().photos.filter(p => nameSet.has(p.name))
    removed.forEach(p => { if (p.url?.startsWith('blob:')) URL.revokeObjectURL(p.url) })
    const photos = get().photos.filter(p => !nameSet.has(p.name))
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

  reorderGroup(newOrderedPhotos) {
    const updated = newOrderedPhotos.map((p, i) => ({ ...p, meta: { ...p.meta, order: i } }))
    const nameMap = new Map(updated.map(p => [p.name, p]))
    const photos = get().photos.map(p => nameMap.has(p.name) ? nameMap.get(p.name) : p)
    const activeGroup = get().activeGroup
    const updatedActive = activeGroup?.some(p => nameMap.has(p.name)) ? updated : activeGroup
    set({ photos, groups: groupByTime(photos.filter(p => p.hasGps)), activeGroup: updatedActive })
  },

  setUploadOpen(open) {
    set({ uploadOpen: open })
  },

  clearPhotos() {
    get().photos.forEach(p => { if (p.url?.startsWith('blob:')) URL.revokeObjectURL(p.url) })
    set({ photos: [], groups: [], activeGroup: null, uploadOpen: false, toast: null, flyToPhoto: null })
  },
}))
