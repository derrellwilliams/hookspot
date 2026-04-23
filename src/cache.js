const DB_NAME = 'fishmap-cache'
const DB_VERSION = 2
const PHOTOS_STORE = 'photos'
const META_STORE = 'metadata'

let _db = null

async function openDB() {
  if (_db) return _db
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = e.target.result
      if (!db.objectStoreNames.contains(PHOTOS_STORE)) db.createObjectStore(PHOTOS_STORE)
      if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE)
    }
    req.onsuccess = () => { _db = req.result; resolve(_db) }
    req.onerror = () => reject(req.error)
  })
}

async function get(store, key) {
  try {
    const db = await openDB()
    return await new Promise((resolve) => {
      const req = db.transaction(store).objectStore(store).get(key)
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = () => resolve(null)
    })
  } catch { return null }
}

async function set(store, key, value) {
  try {
    const db = await openDB()
    await new Promise((resolve) => {
      const tx = db.transaction(store, 'readwrite')
      value === undefined
        ? tx.objectStore(store).delete(key)
        : tx.objectStore(store).put(value, key)
      tx.oncomplete = resolve
      tx.onerror = resolve
    })
  } catch { /* non-fatal */ }
}

export const getCached = (key) => get(PHOTOS_STORE, key)
export const setCached = (key, value) => set(PHOTOS_STORE, key, value)
export const getMeta = (key) => get(META_STORE, key)
export const setMeta = (key, value) => set(META_STORE, key, value)
