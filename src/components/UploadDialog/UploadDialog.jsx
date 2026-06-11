import { useState, useRef, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useShallow } from 'zustand/react/shallow'
import * as Dialog from '@radix-ui/react-dialog'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { Xmark, MediaImage } from 'iconoir-react'
import { Button, Input, SelectWithCustom } from '../ui/index.js'
import { usePhotoStore } from '../../store/usePhotoStore.js'
import { useAuthStore } from '../../store/useAuthStore.js'
import { useCanHover } from '../../hooks/useIsMobile.js'
import { handleFiles } from '../../lib/fileLoader.js'
import { extractExif, toDisplayBlob } from '../../exif.js'
import { supabase } from '../../lib/supabase.js'
import { parseExifDate, cleanGear } from '../../lib/formatters.js'
import { identifySpecies } from '../../identify.js'
import { ThumbStrip } from './ThumbStrip.jsx'
import styles from './UploadDialog.module.css'
import { MAPBOX_TOKEN, MAP_STYLE } from '../../lib/mapbox.js'

const spring = { type: 'spring', stiffness: 300, damping: 24 }
const STEP_FADE = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.15 } }

function computeHomeCenter(photos) {
  const pts = photos.filter(p => p.isOwn && p.hasGps && p.exif?.latitude != null && p.exif?.longitude != null)
  if (!pts.length) return null
  const sum = pts.reduce((acc, p) => ({ lat: acc.lat + p.exif.latitude, lng: acc.lng + p.exif.longitude }), { lat: 0, lng: 0 })
  return { center: [sum.lng / pts.length, sum.lat / pts.length], zoom: 5 }
}

export function UploadDialog() {
  const uploadOpen = usePhotoStore(s => s.uploadOpen)
  const setUploadOpen = usePhotoStore(s => s.setUploadOpen)
  const showToast = usePhotoStore(s => s.showToast)
  const setPendingUploadFiles = usePhotoStore(s => s.setPendingUploadFiles)
  const user = useAuthStore(s => s.user)
  const setUser = useAuthStore(s => s.setUser)
  const gearRods = useAuthStore(useShallow(s => s.user?.user_metadata?.gear_rods ?? []))
  const gearFlies = useAuthStore(useShallow(s => s.user?.user_metadata?.gear_flies ?? []))
  const prevRods = gearRods
  const prevFlys = gearFlies

  const [step, setStep] = useState(1)
  const [manualPin, setManualPin] = useState(null)
  const [pendingFiles, setPendingFiles] = useState([])
  const [pendingBlobs, setPendingBlobs] = useState([])
  const [pendingUrls, setPendingUrls] = useState([])
  const [species, setSpecies] = useState('')
  const [rod, setRod] = useState('')
  const [fly, setFly] = useState('')
  const [identifying, setIdentifying] = useState(false)
  const [loading, setLoading] = useState(false)
  const [dropOver, setDropOver] = useState(false)
  const canHover = useCanHover()
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const locationMapInstanceRef = useRef(null)
  const locationMarkerRef = useRef(null)
  const mapCenterRef = useRef(null)

  // Callback ref: initializes the map as soon as the container mounts, and cleans up on unmount.
  // A plain useEffect(fn, [step]) fires before AnimatePresence mode="wait" has mounted the new
  // step's DOM node, so locationMapRef.current would be null and the map would never initialize.
  const locationMapRef = useCallback((node) => {
    if (!node) {
      if (locationMarkerRef.current) { locationMarkerRef.current.remove(); locationMarkerRef.current = null }
      if (locationMapInstanceRef.current) { locationMapInstanceRef.current.remove(); locationMapInstanceRef.current = null }
      return
    }
    mapboxgl.accessToken = MAPBOX_TOKEN
    const { center = [-98, 39], zoom = 3 } = mapCenterRef.current ?? {}
    const map = new mapboxgl.Map({ container: node, style: MAP_STYLE, center, zoom })
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'bottom-right')
    locationMapInstanceRef.current = map
    map.on('click', e => {
      const { lng, lat } = e.lngLat
      setManualPin({ lat, lng })
      if (locationMarkerRef.current) {
        locationMarkerRef.current.setLngLat([lng, lat])
      } else {
        const marker = new mapboxgl.Marker({ color: '#000000', draggable: true })
          .setLngLat([lng, lat])
          .addTo(map)
        marker.on('dragend', () => {
          const pos = marker.getLngLat()
          setManualPin({ lat: pos.lat, lng: pos.lng })
        })
        locationMarkerRef.current = marker
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!uploadOpen) return
    const files = usePhotoStore.getState().pendingUploadFiles
    if (!files.length) return
    setPendingUploadFiles([])
    goToNextStep(files)
  }, [uploadOpen])

  function revokeUrls(urls) { urls.forEach(u => URL.revokeObjectURL(u)) }

  function close() {
    revokeUrls(pendingUrls)
    setPendingFiles([]); setPendingBlobs([]); setPendingUrls([])
    setSpecies(''); setRod(''); setFly('')
    setManualPin(null)
    setStep(1)
    setUploadOpen(false)
  }

  async function goToNextStep(files) {
    revokeUrls(pendingUrls)
    const existing = new Set()
    const unique = files.filter(f => existing.has(f.name) ? false : (existing.add(f.name), true))
    setDropOver(false)
    setLoading(true)
    const [blobs, firstExif] = await Promise.all([
      Promise.all(unique.map(f => toDisplayBlob(f))),
      extractExif(unique[0]),
    ])
    setLoading(false)
    const urls = blobs.map(b => URL.createObjectURL(b))
    setPendingFiles(unique)
    setPendingBlobs(blobs)
    setPendingUrls(urls)

    const hasGps = firstExif?.latitude != null && firstExif?.longitude != null
    setManualPin(null)
    if (!hasGps) mapCenterRef.current = computeHomeCenter(usePhotoStore.getState().photos)
    setStep(hasGps ? 3 : 2)
    identifyFirst(blobs[0])
  }

  async function identifyFirst(blob) {
    setIdentifying(true)
    setSpecies('')
    try {
      const s = await identifySpecies(blob)
      if (s) setSpecies(s)
    } finally {
      setIdentifying(false)
    }
  }

  function removeThumb(i) {
    URL.revokeObjectURL(pendingUrls[i])
    const newFiles = pendingFiles.filter((_, idx) => idx !== i)
    const newBlobs = pendingBlobs.filter((_, idx) => idx !== i)
    const newUrls = pendingUrls.filter((_, idx) => idx !== i)
    if (!newFiles.length) { setStep(1); setPendingFiles([]); setPendingBlobs([]); setPendingUrls([]); return }
    setPendingFiles(newFiles)
    setPendingBlobs(newBlobs)
    setPendingUrls(newUrls)
  }

  function reorderThumbs(src, dest) {
    const move = (arr) => { const a = [...arr]; const [el] = a.splice(src, 1); a.splice(dest, 0, el); return a }
    setPendingFiles(move(pendingFiles))
    setPendingBlobs(move(pendingBlobs))
    setPendingUrls(move(pendingUrls))
  }

  async function addMoreFiles(files) {
    const existingNames = new Set(pendingFiles.map(f => f.name))
    const newFiles = files.filter(f => !existingNames.has(f.name))
    if (!newFiles.length) return
    const blobs = await Promise.all(newFiles.map(f => toDisplayBlob(f)))
    const urls = blobs.map(b => URL.createObjectURL(b))
    setPendingFiles(prev => [...prev, ...newFiles])
    setPendingBlobs(prev => [...prev, ...blobs])
    setPendingUrls(prev => [...prev, ...urls])
  }

  async function submit() {
    if (!user) return
    const files = pendingFiles.slice()
    const blobs = pendingBlobs.slice()
    const rodVal = cleanGear(rod)
    const flyVal = cleanGear(fly)

    // Resolve catch coordinates: manual pin → EXIF from first file → null
    let catchLat = manualPin?.lat ?? null
    let catchLng = manualPin?.lng ?? null
    let catchTime = null
    if (!manualPin) {
      const firstExif = await extractExif(files[0]).catch(() => null)
      catchLat = firstExif?.latitude ?? null
      catchLng = firstExif?.longitude ?? null
      const rawTime = firstExif?.DateTimeOriginal
      catchTime = rawTime instanceof Date
        ? rawTime.toISOString()
        : (parseExifDate(rawTime) ? new Date(parseExifDate(rawTime)).toISOString() : null)
    }
    catchTime ??= new Date().toISOString()

    const { data: catchRow, error: catchError } = await supabase
      .from('catches')
      .insert({
        user_id: user.id,
        species: species || null,
        rod: rodVal,
        fly: flyVal,
        lat: catchLat,
        lng: catchLng,
        time: catchTime,
      })
      .select('id')
      .single()

    if (catchError) {
      showToast('Failed to add catch.')
      return
    }

    const catchId = catchRow.id
    const meta = { species, rod: rodVal, fly: flyVal, identified: true, catchId }
    if (catchLat != null && catchLng != null) { meta.manualLat = catchLat; meta.manualLng = catchLng }
    close()
    try {
      const { added = 0 } = await handleFiles(files, meta, blobs) ?? {}
      if (added === 0) {
        await supabase.from('catches').delete().eq('id', catchId)
        showToast('Failed to add catch.')
      } else {
        showToast('Catch added!')
        await saveNewGear(flyVal, rodVal)
      }
    } catch {
      await supabase.from('catches').delete().eq('id', catchId)
      showToast('Failed to add catch.')
    }
  }

  async function saveNewGear(newFly, newRod) {
    const updatedFlies = newFly && !gearFlies.includes(newFly) ? [...gearFlies, newFly] : null
    const updatedRods = newRod && !gearRods.includes(newRod) ? [...gearRods, newRod] : null
    if (!updatedFlies && !updatedRods) return
    const data = {}
    if (updatedFlies) data.gear_flies = updatedFlies
    if (updatedRods) data.gear_rods = updatedRods
    const { data: updated } = await supabase.auth.updateUser({ data })
    if (updated?.user) setUser(updated.user)
  }

  function onFileChange(e) {
    const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'))
    e.target.value = ''
    if (!files.length) return
    if (step === 3) addMoreFiles(files)
    else goToNextStep(files)
  }

  async function onZoneDrop(e) {
    e.preventDefault()
    setDropOver(false)
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
    if (files.length) await goToNextStep(files)
  }

  return (
    <Dialog.Root open={uploadOpen} onOpenChange={open => { if (!open) close() }}>
      <Dialog.Portal forceMount>
        <AnimatePresence>
          {uploadOpen && (
            <>
              <Dialog.Overlay asChild>
                <motion.div
                  className={styles.backdrop}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                />
              </Dialog.Overlay>

              <Dialog.Content className={styles.contentPositioner} aria-describedby={undefined}>
                <motion.div
                  className={styles.content}
                  initial={{ opacity: 0, scale: 0.97, y: 4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.97, y: 4, transition: { duration: 0.15, ease: [0.67, 0.17, 0.62, 0.64] } }}
                  transition={{ delay: 0.05, duration: 0.25, ease: [0.17, 0.67, 0.51, 1] }}
                >
                  <div className={styles.header}>
                    <Dialog.Title className={styles.title}>Add a catch</Dialog.Title>
                    <Dialog.Close asChild><Button variant="icon-sm" aria-label="Close"><Xmark width={20} height={20} /></Button></Dialog.Close>
                  </div>

                  <AnimatePresence mode="wait" initial={false}>
                    {step === 1 && (
                      <motion.div key="step-1" {...STEP_FADE}>
                        <div
                          className={`${styles.dropZone} ${dropOver ? styles.dragOver : ''}`}
                          onDragOver={e => { e.preventDefault(); setDropOver(true) }}
                          onDragEnter={e => { e.preventDefault(); setDropOver(true) }}
                          onDragLeave={() => setDropOver(false)}
                          onDrop={onZoneDrop}
                        >
                          {loading ? (
                            <div className={styles.spinner} />
                          ) : canHover ? (
                            <>
                              <MediaImage width={24} height={24} style={{ opacity: 0.4 }} />
                              <div className={styles.dropLabel}>Drop photos here</div>
                              <div className={styles.dropOr}>or</div>
                              <motion.button
                                className={styles.browseBtn}
                                onClick={() => fileInputRef.current?.click()}
                                whileHover={{ scale: 1.007 }}
                                whileTap={{ scale: 0.975 }}
                                transition={spring}
                              >Browse</motion.button>
                            </>
                          ) : (
                            <>
                              <MediaImage width={24} height={24} style={{ opacity: 0.4 }} />
                              <motion.button
                                className={`${styles.browseBtn} ${styles.touchBtn} ${styles.touchBtnPrimary}`}
                                onClick={() => fileInputRef.current?.click()}
                                whileTap={{ scale: 0.975 }}
                                transition={spring}
                              >Choose photos</motion.button>
                              <motion.button
                                className={`${styles.browseBtn} ${styles.touchBtn}`}
                                onClick={() => cameraInputRef.current?.click()}
                                whileTap={{ scale: 0.975 }}
                                transition={spring}
                              >Take photo</motion.button>
                            </>
                          )}
                        </div>
                      </motion.div>
                    )}

                    {step === 2 && (
                      <motion.div key="step-2" {...STEP_FADE} className={styles.locationStep}>
                        <div className={styles.locationBanner}>No GPS data found — pin your catch location</div>
                        <div ref={locationMapRef} className={styles.locationMap} />
                        <div className={styles.locationFooter}>
                          <div className={styles.locationCoords}>
                            {manualPin
                              ? `${manualPin.lat.toFixed(4)}, ${manualPin.lng.toFixed(4)}`
                              : 'Click the map to place a pin'}
                          </div>
                          <div className={styles.locationActions}>
                            <Button variant="secondary" onClick={() => { setStep(1); setManualPin(null) }}>Back</Button>
                            <Button variant="primary" onClick={() => setStep(3)} disabled={!manualPin}>Next</Button>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {step === 3 && (
                      <motion.div key="step-3" {...STEP_FADE}>
                        <div className={styles.previewWrap}>
                          <img className={styles.previewImg} src={pendingUrls[0]} alt="preview" />
                        </div>
                        <ThumbStrip
                          urls={pendingUrls}
                          heroIndex={0}
                          onRemove={removeThumb}
                          onReorder={reorderThumbs}
                          onSelect={() => {}}
                          onAddClick={() => fileInputRef.current?.click()}
                        />
                        <div className={styles.form}>
                          <label>Species</label>
                          <div className={styles.inputWrap}>
                            <Input
                              value={species}
                              onChange={e => setSpecies(e.target.value)}
                              placeholder={identifying ? 'Identifying…' : 'e.g. Brown Trout'}
                              disabled={identifying}
                              className={identifying ? styles.inputLoading : ''}
                              autoFocus
                            />
                            {identifying && <div className={styles.inputSpinner} />}
                          </div>
                          <label>Rod</label>
                          <SelectWithCustom value={rod} onChange={e => setRod(e.target.value)} placeholder="Select your rod" suggestions={prevRods} />
                          <label>Fly</label>
                          <SelectWithCustom value={fly} onChange={e => setFly(e.target.value)} placeholder="Select your fly" suggestions={prevFlys} />
                          <div className={styles.actions}>
                            <Button variant="secondary" onClick={close}>Cancel</Button>
                            <Button variant="primary" onClick={submit}>Add Catch</Button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <input
                    id="__file-input"
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    style={{ display: 'none' }}
                    onChange={onFileChange}
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: 'none' }}
                    onChange={onFileChange}
                  />
                </motion.div>
              </Dialog.Content>
            </>
          )}
        </AnimatePresence>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
