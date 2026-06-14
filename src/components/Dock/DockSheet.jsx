import { useEffect, useRef, useState } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'motion/react'
import { usePhotoStore } from '../../store/usePhotoStore.js'
import { useSafeAreaInsets } from '../../hooks/useSafeAreaInsets.js'
import { DockTabBar } from './DockTabBar.jsx'
import styles from './Dock.module.css'

const HANDLE_H = 13
const TAB_BAR_H = 61
const H_COLLAPSED = HANDLE_H + TAB_BAR_H
const DRAG_SLOP = 8
const VELOCITY_BIAS = 0.15
const RUBBER_BAND = 0.2
const SNAP_SPRING = { type: 'spring', stiffness: 400, damping: 38 }

function useViewportHeight() {
  const [vh, setVh] = useState(() => window.visualViewport?.height ?? window.innerHeight)
  useEffect(() => {
    const onResize = () => setVh(window.visualViewport?.height ?? window.innerHeight)
    window.addEventListener('resize', onResize)
    window.visualViewport?.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.visualViewport?.removeEventListener('resize', onResize)
    }
  }, [])
  return vh
}

export function DockSheet({ children }) {
  const insets = useSafeAreaInsets()
  const vh = useViewportHeight()
  const activeGroup = usePhotoStore(s => s.activeGroup)

  // Native dock geometry: mid card ~49% height (9px inset), full bleed top at safeTop + 10
  const H_MID = Math.round(vh * 0.60) - 9
  const H_FULL = vh - insets.top - 10
  const snaps = [H_COLLAPSED, H_MID, H_FULL]

  const h = useMotionValue(H_MID)
  const snapIndexRef = useRef(1)
  const dragRef = useRef(null)
  const suppressClickRef = useRef(false)

  const sideInset = useTransform(h, snaps, [24, 9, 0])
  const bottomGap = useTransform(h, snaps, [18 + insets.bottom, 9, 0])
  const separatorOpacity = useTransform(h, [H_COLLAPSED, H_MID], [0, 1])
  // Home-indicator clearance only appears at full bleed (matches native)
  const tabClearance = useTransform(h, [H_MID, H_FULL], [0, Math.max(insets.bottom - 14, 0)])
  const tabAreaH = useTransform(tabClearance, c => TAB_BAR_H + c)

  function snapTo(index) {
    snapIndexRef.current = index
    animate(h, snaps[index], SNAP_SPRING)
  }

  // Keep the sheet pinned to its snap point when the viewport resizes
  // (orientation change, iOS URL bar collapse).
  useEffect(() => {
    if (!dragRef.current) h.set(snaps[snapIndexRef.current])
  }, [vh, insets.top, insets.bottom]) // eslint-disable-line react-hooks/exhaustive-deps

  // Selecting a catch (list tap or marker tap both set activeGroup) collapses
  // the sheet so the map and popup are visible.
  useEffect(() => {
    if (activeGroup) snapTo(0)
  }, [activeGroup]) // eslint-disable-line react-hooks/exhaustive-deps

  function onPointerDown(e) {
    dragRef.current = { startY: e.clientY, startH: h.get(), dragging: false }
  }

  function onPointerMove(e) {
    const s = dragRef.current
    if (!s) return
    const dy = e.clientY - s.startY
    if (!s.dragging && Math.abs(dy) > DRAG_SLOP) {
      s.dragging = true
      // Capture only once a drag starts — capturing on pointerdown would
      // retarget the tap's click away from the tab buttons.
      try { e.currentTarget.setPointerCapture(e.pointerId) } catch { /* stale/synthetic pointer */ }
    }
    if (!s.dragging) return
    let next = s.startH - dy
    if (next > H_FULL) next = H_FULL + (next - H_FULL) * RUBBER_BAND
    else if (next < H_COLLAPSED) next = H_COLLAPSED - (H_COLLAPSED - next) * RUBBER_BAND
    h.set(next)
  }

  function onPointerUp() {
    const s = dragRef.current
    dragRef.current = null
    if (!s?.dragging) return
    suppressClickRef.current = true
    setTimeout(() => { suppressClickRef.current = false })
    const projected = h.get() + h.getVelocity() * VELOCITY_BIAS
    let nearest = 0
    for (let i = 1; i < snaps.length; i++) {
      if (Math.abs(snaps[i] - projected) < Math.abs(snaps[nearest] - projected)) nearest = i
    }
    snapTo(nearest)
  }

  function suppressDragClick(e) {
    if (suppressClickRef.current) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  const dragHandlers = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
    onClickCapture: suppressDragClick,
  }

  return (
    <motion.div
      className={styles.sheet}
      style={{ height: h, bottom: bottomGap, left: sideInset, right: sideInset }}
    >
      <div
        className={styles.handleArea}
        {...dragHandlers}
        onClick={e => {
          suppressDragClick(e)
          if (!e.defaultPrevented) snapTo(snapIndexRef.current === 0 ? 1 : 0)
        }}
      >
        <div className={styles.grabber} />
      </div>
      <motion.div className={styles.content} style={{ bottom: tabAreaH }}>
        {children}
      </motion.div>
      <motion.div className={styles.separator} style={{ bottom: tabAreaH, opacity: separatorOpacity }} />
      <motion.div
        className={styles.tabBar}
        style={{ height: tabAreaH, paddingBottom: tabClearance }}
        {...dragHandlers}
      >
        <DockTabBar />
      </motion.div>
    </motion.div>
  )
}
