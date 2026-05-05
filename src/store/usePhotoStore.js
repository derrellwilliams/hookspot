import { create } from 'zustand'
import { groupByTime } from '../lib/groupByTime.js'

const pk = p => `${p.userId}/${p.name}`

export const usePhotoStore = create((set, get) => ({
  photos: [],
  groups: [],
  flyToPhoto: null,
  activeGroup: null,
  toast: null,
  uploadOpen: false,
  bulkUploading: false,
  pendingUploadFiles: [],
  ownOnly: false,
  photosInitialized: false,

  addPhoto(photo) {
    const photos = [...get().photos, photo]
    set({ photos, groups: groupByTime(photos.filter(p => p.hasGps)) })
  },

  updatePhoto(updatedPhoto) {
    const key = pk(updatedPhoto)
    const photos = get().photos.map(p => pk(p) === key ? updatedPhoto : p)
    set({ photos, groups: groupByTime(photos.filter(p => p.hasGps)) })
  },

  removePhotos(toDelete) {
    const keySet = new Set((Array.isArray(toDelete) ? toDelete : [toDelete]).map(pk))
    const removed = get().photos.filter(p => keySet.has(pk(p)))
    removed.forEach(p => { if (p.url?.startsWith('blob:')) URL.revokeObjectURL(p.url) })
    const photos = get().photos.filter(p => !keySet.has(pk(p)))
    set({ photos, groups: groupByTime(photos.filter(p => p.hasGps)), activeGroup: null })
  },

  removeUserPhotos(userId) {
    const toRemove = get().photos.filter(p => p.userId === userId)
    toRemove.forEach(p => { if (p.url?.startsWith('blob:')) URL.revokeObjectURL(p.url) })
    const photos = get().photos.filter(p => p.userId !== userId)
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
    const keyMap = new Map(updated.map(p => [pk(p), p]))
    const photos = get().photos.map(p => keyMap.get(pk(p)) ?? p)
    const activeGroup = get().activeGroup
    const updatedActive = activeGroup?.some(p => keyMap.has(pk(p))) ? updated : activeGroup
    set({ photos, groups: groupByTime(photos.filter(p => p.hasGps)), activeGroup: updatedActive })
  },

  setUploadOpen(open) {
    set({ uploadOpen: open })
  },

  setBulkUploading(v) {
    set({ bulkUploading: v })
  },

  setPendingUploadFiles(files) {
    set({ pendingUploadFiles: files })
  },

  setOwnOnly(v) {
    set({ ownOnly: v })
  },

  setPhotosInitialized() {
    set({ photosInitialized: true })
  },

  clearPhotos() {
    get().photos.forEach(p => { if (p.url?.startsWith('blob:')) URL.revokeObjectURL(p.url) })
    set({ photos: [], groups: [], activeGroup: null, uploadOpen: false, toast: null, flyToPhoto: null, photosInitialized: false })
  },
}))
