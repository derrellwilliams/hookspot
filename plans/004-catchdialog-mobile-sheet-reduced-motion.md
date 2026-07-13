# 004 — Respect reduced motion in CatchDialog's mobile bottom sheet

- **Status**: DONE
- **Commit**: 0007450
- **Severity**: HIGH
- **Category**: Accessibility
- **Estimated scope**: 1 file, small change

## Problem

`CatchDialog` is the most-used dialog in the app — it opens on every catch view, from the map, the feed, and search. On mobile it renders as a bottom sheet that animates a full `y: '100%'` position change (its own height, sliding fully on/off screen) with zero `prefers-reduced-motion` handling anywhere in the component.

```jsx
// src/components/CatchDialog/CatchDialog.jsx:63-73 — current
<motion.div
  className={styles.content}
  initial={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.97, y: 4 }}
  animate={isMobile ? { y: 0 } : { opacity: 1, scale: 1, y: 0 }}
  exit={isMobile
    ? { y: '100%', transition: { duration: 0.3, ease: EASE_DRAWER } }
    : { opacity: 0, scale: 0.97, y: 4, transition: { duration: 0.15, ease: EASE_OUT } }}
  transition={isMobile
    ? { duration: 0.35, ease: EASE_DRAWER }
    : { duration: 0.25, ease: EASE_ENTER }}
>
```

Per AUDIT.md category 6: "Reduced motion means fewer and gentler animations, not zero — keep transitions that aid comprehension, remove position changes." The mobile sheet's `y: '100%'` slide is exactly the kind of position change that should collapse to an opacity fade under reduced motion; the desktop branch's `y: 4` is a 4px nudge, subtle enough to leave as-is (consistent with how `mapPopupIn`/`mapPopupFade` in `src/style.css:68-94` only strip the larger `translateY(6px)` + `scale(0.97)` under reduced motion, keeping opacity).

## Target

Import `useReducedMotion` and branch the mobile sheet's `initial`/`animate`/`exit` to opacity-only when reduced motion is active, leaving the desktop centered-dialog path untouched (its 4px/0.97 nudge is already subtle and consistent with the rest of the app's reduced-motion treatment elsewhere, e.g. `PixelFishLoader`/`DitherMesh` don't fully disable their own motion either — they reduce it).

```jsx
// target — src/components/CatchDialog/CatchDialog.jsx:1-11 (imports)
import { useMemo } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import * as Dialog from '@radix-ui/react-dialog'
import { NavArrowLeft, NavArrowRight } from '../icons.js'
import { usePhotoStore } from '../../store/usePhotoStore.js'
import { deletePhotos } from '../../lib/fileLoader.js'
import { PopupCarousel } from '../Map/PopupCarousel.jsx'
import { useIsMobile, useReducedMotion } from '../../hooks/useIsMobile.js'
import { sortByRecency } from '../../lib/groupPhotos.js'
import { EASE_OUT, EASE_ENTER, EASE_DRAWER } from '../../lib/motion.js'
import styles from './CatchDialog.module.css'
```

```jsx
// target — src/components/CatchDialog/CatchDialog.jsx:16-21 (component body, inside CatchDialog())
export function CatchDialog() {
  const activeGroup = usePhotoStore(s => s.activeGroup)
  const groups = usePhotoStore(s => s.groups)
  const setActiveGroup = usePhotoStore(s => s.setActiveGroup)
  const isMobile = useIsMobile()
  const reducedMotion = useReducedMotion()
```

```jsx
// target — src/components/CatchDialog/CatchDialog.jsx:63-73 (the motion.div)
<motion.div
  className={styles.content}
  initial={
    isMobile
      ? (reducedMotion ? { opacity: 0 } : { y: '100%' })
      : { opacity: 0, scale: 0.97, y: 4 }
  }
  animate={
    isMobile
      ? (reducedMotion ? { opacity: 1 } : { y: 0 })
      : { opacity: 1, scale: 1, y: 0 }
  }
  exit={
    isMobile
      ? (reducedMotion
          ? { opacity: 0, transition: { duration: 0.2, ease: EASE_OUT } }
          : { y: '100%', transition: { duration: 0.3, ease: EASE_DRAWER } })
      : { opacity: 0, scale: 0.97, y: 4, transition: { duration: 0.15, ease: EASE_OUT } }
  }
  transition={
    isMobile
      ? (reducedMotion ? { duration: 0.2, ease: EASE_OUT } : { duration: 0.35, ease: EASE_DRAWER })
      : { duration: 0.25, ease: EASE_ENTER }
  }
>
```

## Repo conventions to follow

- `useReducedMotion()` import path: `src/hooks/useIsMobile.js`, already exports it alongside `useIsMobile` — import both from the same specifier, as already done for `useIsMobile`/`useCanHover` together elsewhere (e.g. no existing dual-import example in this exact file, but the export site groups them: `src/hooks/useIsMobile.js:19-29`).
- The opacity-only reduced-motion fallback duration (`0.2s`) plus `EASE_OUT` mirrors the existing `mapPopupFade` pattern at `src/style.css:86-94` (`animation: mapPopupFade 0.2s var(--ease-out)` under `@media (prefers-reduced-motion: reduce)`), which is this repo's established "strip position, keep a quick opacity fade" convention for popups/sheets.

## Steps

1. In `src/components/CatchDialog/CatchDialog.jsx:8`, change the import `import { useIsMobile } from '../../hooks/useIsMobile.js'` to `import { useIsMobile, useReducedMotion } from '../../hooks/useIsMobile.js'`.
2. Inside `CatchDialog()`, immediately after the existing `const isMobile = useIsMobile()` line, add `const reducedMotion = useReducedMotion()`.
3. Replace the `motion.div`'s `initial`, `animate`, `exit`, and `transition` props (current lines 65-72) with the branched versions shown in Target, exactly as written.

## Boundaries

- Do NOT change the desktop (`!isMobile`) branch at all — its existing 4px/0.97 nudge stays as-is regardless of `reducedMotion`.
- Do NOT modify `CatchDialog.module.css`.
- Do NOT touch the backdrop (`Dialog.Overlay`'s `motion.div`, lines 42-50) — this plan is scoped to the sheet content only.
- Do NOT add a reduced-motion branch to `PopupCarousel` (rendered inside this dialog) — out of scope for this plan.
- If the JSX has drifted from the snippet above (since commit 0007450), STOP and report instead of improvising.

## Verification

- **Mechanical**: `npm run build` — expect a clean build.
- **Feel check**: at a mobile viewport (≤600px), with DevTools Rendering panel set to emulate `prefers-reduced-motion: reduce`:
  - Tap a catch card to open `CatchDialog` — the sheet should fade in in place (no slide-up from the bottom edge) over ~200ms.
  - Close it (tap outside or back) — it should fade out in place, not slide down.
  - Turn off the reduced-motion emulation, reload, and confirm the sheet slides up from the bottom exactly as before (full `y: '100%'` → `0` over 350ms with the drawer curve).
  - At desktop width (>600px), confirm the centered dialog's subtle scale/y nudge is unaffected by toggling reduced-motion (it was already acceptable and is out of scope).
- **Done when**: with reduced motion active, the mobile sheet only fades (no `y` translation); with it inactive, behavior is pixel-identical to before this change; desktop is untouched either way.
