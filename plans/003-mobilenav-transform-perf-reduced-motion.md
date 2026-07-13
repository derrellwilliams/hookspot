# 003 — MobileNav: animate transform instead of layout properties, and respect reduced motion

- **Status**: DONE
- **Commit**: 0007450
- **Severity**: HIGH
- **Category**: Performance & Accessibility
- **Estimated scope**: 2 files (MobileNav.jsx, MobileNav.module.css)

## Problem

`MobileNav` is the app's highest-frequency chrome element — mounted on every page, re-rendering on every scroll tick via a capture-phase listener driving a Framer Motion spring. Two separate problems compound in the same code region:

**(A) Performance — animating layout properties, not transform.** The scroll spring drives `paddingLeft`/`paddingRight`, `height`, and `width`, all of which trigger layout + paint + composite on every animation frame, plus Framer's `scale` shorthand via `style={{ scale: ... }}`, which is not hardware-accelerated:

```jsx
// src/components/MobileNav/MobileNav.jsx:38-43 — current
const t = useSpring(0, SHRINK_SPRING)
const sideInset = useTransform(t, [0, 1], [FULL.inset, COMPACT.inset])
const barH = useTransform(t, [0, 1], [FULL.barH, COMPACT.barH])
const addSize = useTransform(t, [0, 1], [FULL.add, COMPACT.add])
const iconScale = useTransform(t, [0, 1], [1, 0.9])
const plusScale = useTransform(t, [0, 1], [1, 0.85])
```

```jsx
// src/components/MobileNav/MobileNav.jsx:71-72 — current
<motion.div className={styles.wrap} style={{ paddingLeft: sideInset, paddingRight: sideInset }}>
  <motion.nav className={styles.pill} style={{ height: barH }} aria-label="Main">
```

```jsx
// src/components/MobileNav/MobileNav.jsx:90 — current
<motion.div className={styles.iconWrap} style={{ scale: iconScale }}>
```

```jsx
// src/components/MobileNav/MobileNav.jsx:103-110 — current
<motion.button
  className={styles.addBtn}
  style={{ width: addSize, height: addSize }}
  onClick={() => user ? setUploadOpen(true) : navigate('/login')}
  aria-label="Add catch"
  whileTap={{ scale: 0.92 }}
>
  <motion.div className={styles.iconWrap} style={{ scale: plusScale }}>
```

**(B) Accessibility — no reduced-motion handling anywhere in the file.** `useReducedMotion()` already exists in `src/hooks/useIsMobile.js` and is wired into `PixelFishLoader.jsx`/`DitherMesh.jsx`, but `MobileNav.jsx` never imports it. The shrink/expand-on-scroll motion, the tab-selection bounce (`iconVariants`, lines 16-19), and the stadium slide all move unconditionally.

## Target

Fix both in one pass since they touch the same code region: convert the scroll-driven shrink from animating `padding`/`height`/`width` to animating `transform: scale()` on the outer wrap, and gate all motion on `useReducedMotion()`.

**Geometry approach**: instead of interpolating discrete `FULL`/`COMPACT` px values for `padding`/`height`/`width`, scale the whole pill container down uniformly with `transform: scale()`, computed once as a ratio (`COMPACT.barH / FULL.barH`), and use `transform-origin: center` so it shrinks toward its own center (matching the current visual — the pill stays horizontally centered as it shrinks). The `addBtn`'s width/height sizing likewise becomes a `scale()` on the button rather than animating `width`/`height` directly.

```jsx
// target — src/components/MobileNav/MobileNav.jsx:1-28 (imports + constants)
import { useEffect } from 'react'
import { motion, useSpring, useTransform } from 'motion/react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Home, Plus, Search, User } from '../icons.js'
import { usePhotoStore } from '../../store/usePhotoStore.js'
import { useAuthStore } from '../../store/useAuthStore.js'
import { useReducedMotion } from '../../hooks/useIsMobile.js'
import styles from './MobileNav.module.css'

const TABS = [
  { path: '/', label: 'Catches', Icon: Home },
  { path: '/profile', label: 'Profile', Icon: User },
  { path: '/search', label: 'Search', Icon: Search },
]

const stadiumSpring = { type: 'spring', stiffness: 500, damping: 38 }
const iconVariants = {
  active:   { scale: [1, 1.2, 0.88, 1.06, 1] },
  inactive: { scale: 1 },
}
const iconTransition = { duration: 0.38, times: [0, 0.2, 0.5, 0.7, 1] }
const REDUCED_ICON_TRANSITION = { duration: 0.15 }

// Instagram-metric geometry: full-size ↔ compact, driven by scroll direction.
// SHRINK_RATIO is COMPACT.barH / FULL.barH — applied as a uniform transform
// scale on .wrap instead of animating padding/height/width (layout properties).
const FULL = { inset: 20, barH: 58, add: 46 }
const COMPACT = { inset: 44, barH: 46, add: 34 }
const SHRINK_RATIO = COMPACT.barH / FULL.barH
const SHRINK_SPRING = { stiffness: 320, damping: 34 }
const SCROLL_SLOP = 12
const TOP_ZONE = 24
```

```jsx
// target — src/components/MobileNav/MobileNav.jsx (component body)
export function MobileNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const setUploadOpen = usePhotoStore(s => s.setUploadOpen)
  const user = useAuthStore(s => s.user)
  const path = location.pathname
  const reducedMotion = useReducedMotion()

  // 0 = full size, 1 = compact
  const t = useSpring(0, SHRINK_SPRING)
  const navScale = useTransform(t, [0, 1], [1, SHRINK_RATIO])

  useEffect(() => {
    if (reducedMotion) return
    const lastTops = new WeakMap()
    function onScroll(e) {
      const el = e.target === document ? document.scrollingElement : e.target
      if (!el || typeof el.scrollTop !== 'number') return
      const top = el.scrollTop
      const last = lastTops.get(el) ?? top
      lastTops.set(el, top)
      const delta = top - last
      if (top <= TOP_ZONE) t.set(0)
      else if (delta > SCROLL_SLOP) t.set(1)
      else if (delta < -SCROLL_SLOP) t.set(0)
    }
    window.addEventListener('scroll', onScroll, true)
    return () => window.removeEventListener('scroll', onScroll, true)
  }, [t, reducedMotion])

  // Fresh page starts at full size
  useEffect(() => {
    t.set(0)
  }, [path, t])

  return (
    <motion.div className={styles.wrap} style={{ scale: reducedMotion ? 1 : navScale }}>
      <motion.nav className={styles.pill} aria-label="Main">
        {TABS.map(({ path: itemPath, label, Icon }) => {
          const isActive = path === itemPath || (itemPath === '/profile' && path.startsWith('/user/'))
          return (
            <motion.button
              key={itemPath}
              className={`${styles.tab} ${isActive ? styles.active : ''}`}
              onClick={() => navigate(itemPath)}
              aria-label={label}
              whileTap={{ scale: 0.9 }}
            >
              {isActive && (
                <motion.div
                  className={styles.stadium}
                  layoutId="mobile-nav-stadium"
                  transition={stadiumSpring}
                />
              )}
              <motion.div className={styles.iconWrap}>
                <motion.div
                  variants={iconVariants}
                  animate={isActive ? 'active' : 'inactive'}
                  transition={reducedMotion ? REDUCED_ICON_TRANSITION : iconTransition}
                >
                  <Icon width={24} height={24} strokeWidth={isActive ? 2.5 : 2} />
                </motion.div>
              </motion.div>
            </motion.button>
          )
        })}
      </motion.nav>
      <motion.button
        className={styles.addBtn}
        onClick={() => user ? setUploadOpen(true) : navigate('/login')}
        aria-label="Add catch"
        whileTap={{ scale: 0.92 }}
      >
        <motion.div className={styles.iconWrap}>
          <Plus width={26} height={26} strokeWidth={2.5} />
        </motion.div>
      </motion.button>
    </motion.div>
  )
}
```

Since `barH`/`addSize`/`sideInset` are no longer animated inline via `style`, their FULL-size values must move into static CSS in `MobileNav.module.css` (the shrink is now purely a `transform: scale()` on the wrapping `.wrap`, which visually shrinks the whole pill+button group together, inset and all — this is actually a closer match to "Instagram-metric" shrink behavior than the current per-property tween, since everything scales as one rigid group instead of insets/height/icon-size drifting independently).

## Repo conventions to follow

- `useReducedMotion()` import path and usage pattern: `src/components/PixelFishLoader.jsx:2,48` (`import { useReducedMotion } from '../hooks/useIsMobile.js'` then `const reducedMotion = useReducedMotion()`).
- Guarding a `useEffect` scroll/resize listener on a reduced-motion flag by early-returning inside the effect (not skipping the effect declaration) is the correct pattern — see how `DitherMesh.jsx` branches its animation loop internally on `reducedMotion` rather than conditionally calling hooks.
- `SHRINK_SPRING` stays a local constant (not promoted to `src/lib/motion.js`) since it's MobileNav-specific tuning, consistent with how `stadiumSpring` remains local too (that duplication across files is handled separately by plan 005 — do not touch `stadiumSpring` in this plan).

## Steps

1. In `src/components/MobileNav/MobileNav.jsx`, add the import `import { useReducedMotion } from '../../hooks/useIsMobile.js'` alongside the existing imports.
2. Replace the constant block (current lines 24-27: `FULL`, `COMPACT`, `SHRINK_SPRING`) with the `FULL`, `COMPACT`, `SHRINK_RATIO`, `SHRINK_SPRING` block shown in Target. Add `const REDUCED_ICON_TRANSITION = { duration: 0.15 }` near `iconTransition`.
3. Inside `MobileNav()`, add `const reducedMotion = useReducedMotion()` as the first line of the function body.
4. Replace the five `useTransform` derivations (current lines 39-43: `sideInset`, `barH`, `addSize`, `iconScale`, `plusScale`) with the single `const navScale = useTransform(t, [0, 1], [1, SHRINK_RATIO])`.
5. In the scroll `useEffect` (current lines 48-63), add `if (reducedMotion) return` as the first line inside the effect body (before `const lastTops = new WeakMap()`), and add `reducedMotion` to the effect's dependency array (`[t, reducedMotion]`).
6. Update the JSX: remove `style={{ paddingLeft: sideInset, paddingRight: sideInset }}` from the outer `motion.div` (current line 71) and replace with `style={{ scale: reducedMotion ? 1 : navScale }}`. Remove `style={{ height: barH }}` from `motion.nav` (current line 72) entirely — height becomes static CSS. Remove `style={{ scale: iconScale }}` (current line 90) and `style={{ width: addSize, height: addSize }}` (current line 105) and `style={{ scale: plusScale }}` (current line 110) entirely — these sizes become static CSS (step 7).
7. In `src/components/MobileNav/MobileNav.module.css`, ensure `.pill` has a static `height: 58px` (the current `FULL.barH` value), `.wrap` has static `padding-left: 20px; padding-right: 20px` (the current `FULL.inset` value), and `.addBtn` has static `width: 46px; height: 46px` (the current `FULL.add` value) — read the existing file first to see whether these are already hardcoded or were previously only ever set via the removed inline `style`, and add/adjust accordingly so the full-size (unscrolled) appearance is pixel-identical to before this change.
8. Change `iconVariants`/`iconTransition` usage (current line 94, inside the tab button) from `transition={iconTransition}` to `transition={reducedMotion ? REDUCED_ICON_TRANSITION : iconTransition}`.

## Boundaries

- Do NOT touch `stadiumSpring` (the layoutId spring for the active-tab stadium indicator) — that duplicate-token issue is handled by plan 005, which must be applied to this same file. If plan 005 has already run when you reach this plan, preserve whatever import of the consolidated token it introduced; if it hasn't, leave `stadiumSpring` exactly as-is.
- Do NOT change `whileTap` values (`0.9` on tabs, `0.92` on `addBtn`) — those are a separate, lower-priority finding not in scope for this plan.
- Do NOT change the `SCROLL_SLOP`/`TOP_ZONE` scroll-detection thresholds or the capture-phase listener registration (`window.addEventListener('scroll', onScroll, true)`) — only the reduced-motion early-return and the animated-property change are in scope.
- Do NOT add `prefers-reduced-motion` CSS media queries to `MobileNav.module.css` — the reduced-motion branch is handled entirely in JS via `useReducedMotion()`, consistent with `PixelFishLoader`/`DitherMesh`.
- If the current CSS in `MobileNav.module.css` already fully specifies `.pill`, `.wrap`, `.addBtn` dimensions independent of the inline styles (i.e. step 7 turns out to be a no-op), verify visually rather than guessing, and note in your summary that no CSS change was needed.
- If any step doesn't match the code you find (drift since commit 0007450), STOP and report instead of improvising.

## Verification

- **Mechanical**: `npm run build` — expect a clean build with no new errors or warnings about unused variables (`sideInset`, `barH`, `addSize`, `iconScale`, `plusScale` should all be gone, not just unused).
- **Feel check**: run the dev server at a mobile viewport (≤600px width, e.g. DevTools device toolbar at 390×844):
  - Scroll a feed down — the whole nav pill + add button should shrink together as one rigid group, still centered, still fully legible. Scroll up — it should expand back.
  - Confirm the shrink is driven by `transform: scale`, not layout: open DevTools Performance panel, record a scroll gesture, and confirm no "Layout" or "Recalculate Style" entries are attributed to `MobileNav`'s scroll handler (only "Composite Layers").
  - Tap a tab — confirm the bounce animation and stadium slide still play normally.
  - In DevTools Rendering panel, enable "Emulate CSS media feature prefers-reduced-motion: reduce", then reload and scroll: the pill should NOT shrink/expand (stays at full size), and tapping a tab should show only a quick 150ms fade/scale via `REDUCED_ICON_TRANSITION`, not the full bounce sequence.
  - Turn reduced-motion back off and confirm normal behavior returns.
- **Done when**: the build is clean, scroll-driven shrink no longer touches `padding`/`height`/`width` in DevTools' Performance panel, and `prefers-reduced-motion: reduce` fully suppresses the shrink/expand and dampens the tab-bounce.
