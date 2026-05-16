const DB_NAME = 'fishmap-cache'
const DB_VERSION = 2
const PHOTOS_STORE = 'photos'
const META_STORE = 'metadata'
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

// Memoize the Promise (not the result) so concurrent callers share one open request
let _dbPromise = null

function openDB() {
  if (!_dbPromise) {
    _dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = (e) => {
        const db = e.target.result
        if (!db.objectStoreNames.contains(PHOTOS_STORE)) db.createObjectStore(PHOTOS_STORE)
        if (!db.objectStoreNames.contains(META_STORE)) db.createObjectStore(META_STORE)
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return _dbPromise
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
    await new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite')
      value === undefined
        ? tx.objectStore(store).delete(key)
        : tx.objectStore(store).put(value, key)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch (e) { console.warn('[cache] write failed:', e) }
}

export async function getCached(key) {
  const entry = await get(PHOTOS_STORE, key)
  if (!entry) return null
  if (!entry.ts || Date.now() - entry.ts > CACHE_TTL_MS) {
    await set(PHOTOS_STORE, key, undefined)
    return null
  }
  return entry
}

export async function setCached(key, value) {
  if (value === undefined) return set(PHOTOS_STORE, key, undefined)
  return set(PHOTOS_STORE, key, { ...value, ts: Date.now() })
}

export const getMeta = (key) => get(META_STORE, key)
export const setMeta = (key, value) => set(META_STORE, key, value)
