import { useState, useRef, useEffect } from 'react'
import { useShallow } from 'zustand/react/shallow'
import * as Dialog from '@radix-ui/react-dialog'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { Xmark, MediaImage } from 'iconoir-react'
import { Button, Input, SelectWithCustom } from '../ui/index.js'
import { usePhotoStore } from '../../store/usePhotoStore.js'
import { useAuthStore } from '../../store/useAuthStore.js'
import { handleFiles } from '../../lib/fileLoader.js'
import { extractExif, toDisplayBlob } from '../../exif.js'
import { identifySpecies } from '../../identify.js'
import { ThumbStrip } from './ThumbStrip.jsx'
import styles from './UploadDialog.module.css'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN
const MAP_STYLE = 'mapbox://styles/derrellwilliams/cmoc96j0y000i01r90nqr62du'

export function UploadDialog() {
  const uploadOpen = usePhotoStore(s => s.uploadOpen)
  const setUploadOpen = usePhotoStore(s => s.setUploadOpen)
  const showToast = usePhotoStore(s => s.showToast)
  const setPendingUploadFiles = usePhotoStore(s => s.setPendingUploadFiles)
  const gearRods = useAuthStore(useShallow(s => s.user?.user_metadata?.gear_rods ?? []))
  const gearFlies = useAuthStore(useShallow(s => s.user?.user_metadata?.gear_flies ?? []))
  const prevRods = gearRods
  const prevFlys = gearFlies

  const [step, setStep] = useState(1)
  const [needsLocation, setNeedsLocation] = useState(false)
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
  const fileInputRef = useRef(null)
  const locationMapRef = useRef(null)
  const locationMapInstanceRef = useRef(null)
  const locationMarkerRef = useRef(null)

  useEffect(() => {
    if (!uploadOpen) return
    const files = usePhotoStore.getState().pendingUploadFiles
    if (!files.length) return
    setPendingUploadFiles([])
    goToNextStep(files)
  }, [uploadOpen])

  // Initialize / destroy the location-picker map when entering/leaving step 2
  useEffect(() => {
    if (step !== 2 || !locationMapRef.current) return

    mapboxgl.accessToken = MAPBOX_TOKEN
    const map = new mapboxgl.Map({
      container: locationMapRef.current,
      style: MAP_STYLE,
      center: [-98, 39],
      zoom: 3,
    })
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

    return () => {
      if (locationMarkerRef.current) { locationMarkerRef.current.remove(); locationMarkerRef.current = null }
      map.remove()
      locationMapInstanceRef.current = null
    }
  }, [step])

  function revokeUrls(urls) { urls.forEach(u => URL.revokeObjectURL(u)) }

  function close() {
    revokeUrls(pendingUrls)
    setPendingFiles([]); setPendingBlobs([]); setPendingUrls([])
    setSpecies(''); setRod(''); setFly('')
    setManualPin(null); setNeedsLocation(false)
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

    const hasGps = !!(firstExif?.latitude && firstExif?.longitude)
    setNeedsLocation(!hasGps)
    setManualPin(null)
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
    const files = pendingFiles.slice()
    const blobs = pendingBlobs.slice()
    const meta = { species, rod, fly, identified: true }
    if (manualPin) { meta.manualLat = manualPin.lat; meta.manualLng = manualPin.lng }
    close()
    try {
      const { added = 0 } = await handleFiles(files, meta, blobs) ?? {}
      showToast(added > 0 ? 'Catch added!' : 'Failed to add catch.')
    } catch {
      showToast('Failed to add catch.')
    }
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
      <Dialog.Portal>
        <Dialog.Overlay className={styles.backdrop} />
        <Dialog.Content className={styles.content} aria-describedby={undefined}>
          <div className={styles.header}>
            <Dialog.Title className={styles.title}>Add a catch</Dialog.Title>
            <Dialog.Close asChild><Button variant="icon-sm" aria-label="Close"><Xmark width={20} height={20} /></Button></Dialog.Close>
          </div>

          {step === 1 && (
            <div
              className={`${styles.dropZone} ${dropOver ? styles.dragOver : ''}`}
              onDragOver={e => { e.preventDefault(); setDropOver(true) }}
              onDragEnter={e => { e.preventDefault(); setDropOver(true) }}
              onDragLeave={() => setDropOver(false)}
              onDrop={onZoneDrop}
            >
              {loading ? (
                <div className={styles.spinner} />
              ) : (
                <>
                  <MediaImage width={24} height={24} style={{opacity:0.4}} />
                  <div className={styles.dropLabel}>Drop photos here</div>
                  <div className={styles.dropOr}>or</div>
                  <button className={styles.browseBtn} onClick={() => fileInputRef.current?.click()}>Browse</button>
                </>
              )}
            </div>
          )}

          {step === 2 && (
            <div className={styles.locationStep}>
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
            </div>
          )}

          {step === 3 && (
            <>
              <div className={styles.previewWrap}>
                <img className={styles.previewImg} src={pendingUrls[0]} alt="preview" />
              </div>
              <ThumbStrip
                urls={pendingUrls}
                heroIndex={0}
                onRemove={removeThumb}
                onReorder={reorderThumbs}
                onSelect={() => {}}
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
            </>
          )}

          <input
            id="__file-input"
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={onFileChange}
          />
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
