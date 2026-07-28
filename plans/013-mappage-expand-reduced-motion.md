# 013 — Respect reduced motion in the map expand/collapse toggle

- **Status**: DONE
- **Commit**: 49b7490
- **Severity**: MEDIUM
- **Category**: Accessibility
- **Estimated scope**: 1 file, small change

## Problem

Clicking the map's expand button drives a layout-morphing width animation on
both `.cardsPane` (shrinks to 0%, fades out) and `.mapPane` (grows to fill),
via Framer Motion's `layout` prop plus a spring transition — with **no
`prefers-reduced-motion` handling** anywhere in `MapPage`.

```jsx
// src/pages/MapPage.jsx:29-38 — current
{!isMobile && (
  <motion.div
    layout
    animate={{ opacity: mapExpanded ? 0 : 1 }}
    transition={{ layout: SPRING, opacity: { duration: 0.15 } }}
    className={`${styles.cardsPane} ${mapExpanded ? styles.cardsPaneCollapsed : ''}`}
  >
    <CatchGrid />
  </motion.div>
)}
```

```jsx
// src/pages/MapPage.jsx:42-46 — current
<motion.div
  layout={!isMobile}
  transition={SPRING}
  className={`${styles.mapPane} ${isMobile && mobileView === 'list' ? styles.mapPaneHidden : ''}`}
>
```

This is inconsistent with the rest of the app: `CatchDialog.jsx`,
`MobileNav.jsx`, and `DitherMesh.jsx` all import `useReducedMotion` from
`src/hooks/useIsMobile.js` and branch their position/size-changing animations
to something gentler when it's active, per AUDIT.md category 6: "Reduced
motion means fewer and gentler animations, not zero — keep transitions that
aid comprehension, remove position changes."

## Target

Import `useReducedMotion`, and when it's active, disable the `layout` FLIP
animation on both panes (so there's no width/position tween — the DOM change
is instant) while keeping the `.cardsPane` opacity fade, which aids
comprehension without any movement.

```jsx
// target — src/pages/MapPage.jsx:6 (imports)
import { useIsMobile, useReducedMotion } from '../hooks/useIsMobile.js'
```

```jsx
// target — src/pages/MapPage.jsx:16-19 (component body, inside MapPage())
export function MapPage({ active }) {
  const isMobile = useIsMobile()
  const reducedMotion = useReducedMotion()
  const [mobileView, setMobileView] = useState('list')
  const [mapExpanded, setMapExpanded] = useState(false)
```

```jsx
// target — src/pages/MapPage.jsx:29-38 (.cardsPane)
{!isMobile && (
  <motion.div
    layout={!reducedMotion}
    animate={{ opacity: mapExpanded ? 0 : 1 }}
    transition={{ layout: SPRING, opacity: { duration: 0.15 } }}
    className={`${styles.cardsPane} ${mapExpanded ? styles.cardsPaneCollapsed : ''}`}
  >
    <CatchGrid />
  </motion.div>
)}
```

```jsx
// target — src/pages/MapPage.jsx:42-46 (.mapPane)
<motion.div
  layout={!isMobile && !reducedMotion}
  transition={SPRING}
  className={`${styles.mapPane} ${isMobile && mobileView === 'list' ? styles.mapPaneHidden : ''}`}
>
```

## Repo conventions to follow

- `useReducedMotion()` import path: `src/hooks/useIsMobile.js`, exported alongside `useIsMobile` (`src/hooks/useIsMobile.js:19-29`) — import both from the same specifier, as done in `src/components/CatchDialog/CatchDialog.jsx:8` (`import { useIsMobile, useReducedMotion } from '../../hooks/useIsMobile.js'`).
- Disabling `layout` entirely (rather than swapping to an opacity-only `animate` target) is the right shape here specifically because these are `layout`-prop width/position animations, not `initial`/`animate`/`exit` position props like `CatchDialog`'s sheet — there's no equivalent "keep opacity, drop the y-offset" branch to write for a `layout` animation; setting `layout={false}` is Motion's documented way to make a layout-driven size/position change instant instead of tweened, which satisfies "remove position changes" while the existing opacity `animate` (already present and untouched) continues to provide the "keep transitions that aid comprehension" feedback.

## Steps

1. In `src/pages/MapPage.jsx:6`, change `import { useIsMobile } from '../hooks/useIsMobile.js'` to `import { useIsMobile, useReducedMotion } from '../hooks/useIsMobile.js'`.
2. Inside `MapPage()`, immediately after the existing `const isMobile = useIsMobile()` line (`MapPage.jsx:17`), add `const reducedMotion = useReducedMotion()`.
3. On the `.cardsPane` `motion.div` (`MapPage.jsx:31`), change `layout` to `layout={!reducedMotion}`.
4. On the `.mapPane` `motion.div` (`MapPage.jsx:43`), change `layout={!isMobile}` to `layout={!isMobile && !reducedMotion}`.

## Boundaries

- Do NOT change the `opacity` `animate`/`transition` on `.cardsPane` — it already provides reduced-motion-appropriate feedback and should fire regardless of `reducedMotion`.
- Do NOT touch the button's `whileHover`/`whileTap`/icon-swap logic, or `MapPage.module.css` — out of scope for this plan (see plans 012 and 014 for those).
- Do NOT add reduced-motion handling to the mobile `viewToggle`/`feedLogo` markup — this plan is scoped to the desktop expand/collapse toggle only.
- If the JSX has drifted from the snippets above (since commit `49b7490`), STOP and report instead of improvising.

## Verification

- **Mechanical**: `npm run build` — expect a clean build.
- **Feel check**: at a desktop viewport (>600px), with Chrome DevTools Rendering panel set to emulate `prefers-reduced-motion: reduce`:
  - Click the expand button — `.cardsPane` should instantly disappear (opacity fade only, no visible width/slide animation) and `.mapPane` should instantly fill the space, with no spring-driven growth.
  - Click again to collapse — same: instant layout change, opacity fade back in.
  - Turn off the reduced-motion emulation, reload, and confirm both panes animate exactly as before this change (spring-driven width morph, 150ms opacity fade).
- **Done when**: with reduced motion active, both panes resize instantly (no `layout` tween) while the opacity fade still plays; with it inactive, behavior is pixel-identical to before this change.
