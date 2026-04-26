import { useState, useRef } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { usePhotoStore } from '../../store/usePhotoStore.js'
import { handleFiles } from '../../lib/fileLoader.js'
import { toDisplayBlob } from '../../exif.js'
import { identifySpecies } from '../../identify.js'
import { ThumbStrip } from './ThumbStrip.jsx'
import styles from './UploadDialog.module.css'

export function UploadDialog() {
  const uploadOpen = usePhotoStore(s => s.uploadOpen)
  const setUploadOpen = usePhotoStore(s => s.setUploadOpen)
  const showToast = usePhotoStore(s => s.showToast)

  const [step, setStep] = useState(1)
  const [pendingFiles, setPendingFiles] = useState([])
  const [pendingBlobs, setPendingBlobs] = useState([])
  const [pendingUrls, setPendingUrls] = useState([])
  const [species, setSpecies] = useState('')
  const [rod, setRod] = useState('')
  const [fly, setFly] = useState('')
  const [identifying, setIdentifying] = useState(false)
  const [dropOver, setDropOver] = useState(false)
  const fileInputRef = useRef(null)

  function revokeUrls(urls) { urls.forEach(u => URL.revokeObjectURL(u)) }

  function close() {
    revokeUrls(pendingUrls)
    setPendingFiles([]); setPendingBlobs([]); setPendingUrls([])
    setSpecies(''); setRod(''); setFly('')
    setStep(1)
    setUploadOpen(false)
  }

  async function goToStep2(files) {
    revokeUrls(pendingUrls)
    const existing = new Set()
    const unique = files.filter(f => existing.has(f.name) ? false : (existing.add(f.name), true))
    setDropOver(false)
    const blobs = await Promise.all(unique.map(f => toDisplayBlob(f)))
    const urls = blobs.map(b => URL.createObjectURL(b))
    setPendingFiles(unique)
    setPendingBlobs(blobs)
    setPendingUrls(urls)
    setStep(2)
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
    close()
    try {
      await handleFiles(files, { species, rod, fly, identified: true }, blobs)
    } catch {}
    showToast('Catch added!')
  }

  function onFileChange(e) {
    const files = Array.from(e.target.files).filter(f => f.type.startsWith('image/'))
    e.target.value = ''
    if (!files.length) return
    if (step === 2) addMoreFiles(files)
    else goToStep2(files)
  }

  async function onZoneDrop(e) {
    e.preventDefault()
    setDropOver(false)
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'))
    if (files.length) await goToStep2(files)
  }

  return (
    <Dialog.Root open={uploadOpen} onOpenChange={open => { if (!open) close() }}>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.backdrop} />
        <Dialog.Content className={styles.content} aria-describedby={undefined}>
          <div className={styles.header}>
            <Dialog.Title className={styles.title}>Add a catch</Dialog.Title>
            <Dialog.Close className={styles.closeBtn} aria-label="Close">&#10005;</Dialog.Close>
          </div>

          {step === 1 && (
            <div
              className={`${styles.dropZone} ${dropOver ? styles.dragOver : ''}`}
              onDragOver={e => { e.preventDefault(); setDropOver(true) }}
              onDragEnter={e => { e.preventDefault(); setDropOver(true) }}
              onDragLeave={() => setDropOver(false)}
              onDrop={onZoneDrop}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{opacity:0.4}}>
                <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>
              </svg>
              <div className={styles.dropLabel}>Drop photos here</div>
              <div className={styles.dropOr}>or</div>
              <button className={styles.browseBtn} onClick={() => fileInputRef.current?.click()}>Browse</button>
            </div>
          )}

          {step === 2 && (
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
                <input
                  type="text"
                  value={species}
                  onChange={e => setSpecies(e.target.value)}
                  placeholder={identifying ? 'Identifying…' : 'e.g. Brown Trout'}
                  disabled={identifying}
                  autoFocus
                />
                {identifying && <div className={styles.identifying}>Identifying species…</div>}
                <label>Rod</label>
                <input type="text" value={rod} onChange={e => setRod(e.target.value)} placeholder="e.g. 9ft 5wt" />
                <label>Fly</label>
                <input type="text" value={fly} onChange={e => setFly(e.target.value)} placeholder="e.g. Elk Hair Caddis #14" />
                <div className={styles.actions}>
                  <button className={styles.submitBtn} onClick={submit}>Add Catch</button>
                  <button className={styles.cancelBtn} onClick={close}>Cancel</button>
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
