# 012 — Fix map pane/button distortion during the expand-map layout animation

- **Status**: DONE
- **Commit**: 49b7490
- **Severity**: HIGH
- **Category**: Physicality & origin (Framer Motion layout-animation correctness)
- **Estimated scope**: 2 files, small change

## Problem

`MapPage`'s expand-map toggle animates `.mapPane`'s width via Framer Motion's
`layout` prop (a FLIP animation: the box snaps to its final size instantly,
then Motion applies a compensating `scale`/`translate` transform and animates
that back to identity). Because only *width* changes here (height is fixed),
that compensating transform is **non-uniform** — `scaleX` moves while `scaleY`
stays ~1.

```jsx
// src/pages/MapPage.jsx:42-65 — current
<motion.div
  layout={!isMobile}
  transition={SPRING}
  className={`${styles.mapPane} ${isMobile && mobileView === 'list' ? styles.mapPaneHidden : ''}`}
>
  <MapView active={active && (!isMobile || mobileView === 'map')} />
  {!isMobile && (
    <motion.button
      className={styles.expandMapBtn}
      onClick={() => setMapExpanded(v => !v)}
      aria-label={mapExpanded ? 'Show catch list' : 'Expand map'}
      aria-pressed={mapExpanded}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.92 }}
      transition={SPRING}
    >
      {mapExpanded ? (
        <MapCollapse width={16} height={16} />
      ) : (
        <MapExpand width={16} height={16} />
      )}
    </motion.button>
  )}
</motion.div>
```

```jsx
// src/components/Map/MapView.jsx:218 — current
return <div ref={containerRef} className={styles.map} />
```

A CSS `transform` on an element visually scales its entire rendered subtree —
this is true for any DOM content, including a `<canvas>`. Neither
`expandMapBtn` nor `MapView`'s root `<div>` (which fills `.mapPane` via
`position: absolute; inset: 0` in `src/components/Map/Map.module.css:1-5` and
hosts the Mapbox WebGL canvas) carry their own `layout` prop, so both inherit
`.mapPane`'s non-uniform `scaleX` for the ~330ms spring settle: the circular
`expandMapBtn` will briefly go oval, and the entire map — including the
Mapbox canvas — will visibly stretch/squish horizontally. This is documented
Framer Motion behavior: a `layout` element's non-`layout` children distort
during its FLIP animation; giving a child its own `layout` prop makes Motion
apply the matching corrective transform to that child specifically, canceling
the inherited distortion.

## Target

Add `layout` to `expandMapBtn` and convert `MapView`'s root element to a
`motion.div` with `layout`, so both self-correct against the parent's
non-uniform scale instead of inheriting it.

```jsx
// target — src/pages/MapPage.jsx:49-57
<motion.button
  layout
  className={styles.expandMapBtn}
  onClick={() => setMapExpanded(v => !v)}
  aria-label={mapExpanded ? 'Show catch list' : 'Expand map'}
  aria-pressed={mapExpanded}
  whileHover={{ scale: 1.06 }}
  whileTap={{ scale: 0.92 }}
  transition={SPRING}
>
```

```jsx
// target — src/components/Map/MapView.jsx:1 (imports)
import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
```

```jsx
// target — src/components/Map/MapView.jsx:218
return <motion.div layout ref={containerRef} className={styles.map} />
```

## Repo conventions to follow

- `motion/react` is the import specifier used everywhere else in this repo for Framer Motion (e.g. `src/pages/MapPage.jsx:2`) — do not import from `framer-motion`.
- `layout` composing with `whileHover`/`whileTap` on the same element already happens elsewhere with no special handling needed (Motion merges independent transform contributions) — no exemplar needed, this is standard Motion behavior, not a repo-specific pattern.
- Do not add a `transition` override for the new `layout` props — both elements should use their existing `transition={SPRING}` (button) and inherit the default layout transition (MapView's div doesn't currently take a `transition` prop; leave it unset so Motion uses its default spring, which is what actually needs to match `.mapPane`'s own `SPRING` for the correction to look seamless — if it visibly lags or leads the parent during the feel check, add `transition={SPRING}` to the `MapView` root `motion.div` as a follow-up, but do not guess this speculatively in this pass).

## Steps

1. In `src/pages/MapPage.jsx:49`, add a `layout` prop to the `motion.button` (`expandMapBtn`), immediately after the opening `<motion.button` tag, before `className`.
2. In `src/components/Map/MapView.jsx:1`, add `import { motion } from 'motion/react'` on its own line directly after the existing `import { useEffect, useRef, useState } from 'react'` line.
3. In `src/components/Map/MapView.jsx:218`, change `return <div ref={containerRef} className={styles.map} />` to `return <motion.div layout ref={containerRef} className={styles.map} />`.

## Boundaries

- Do NOT change `.mapPane`'s own `layout`/`transition` props (`MapPage.jsx:43-44`) — this plan only adds corrective `layout` to the two affected children.
- Do NOT touch the Mapbox initialization, `ResizeObserver`, or any other logic inside `MapView.jsx` — this is a one-line element-type change (`div` → `motion.div`) plus the matching import.
- Do NOT modify `Map.module.css` or `MapPage.module.css`.
- Do NOT add `layout` to any other element in either file (e.g. the `CatchDialog`, `CatchGrid`, or mobile view-toggle markup) — out of scope.
- If either snippet has drifted from what's shown above (since commit `49b7490`), STOP and report instead of improvising.

## Verification

- **Mechanical**: `npm run build` — expect a clean build with no new warnings.
- **Feel check**: at a desktop viewport (>600px), open Chrome DevTools → More tools → Animations (or Rendering panel with playback slowed), click the map's expand button:
  - Before the fix, at 10% playback speed, the circular button visibly ovals and the map content visibly smears sideways during the ~330ms transition.
  - After the fix, the button stays circular throughout, and the map canvas resizes without visibly stretching (some blur/refresh as Mapbox's internal tiles recompute is fine and expected — that's Mapbox's own rendering, not a CSS distortion).
  - Click rapidly (toggle expand/collapse several times in a row) and confirm neither element ever visibly deforms mid-transition.
  - Confirm the button's hover/tap scale feedback (`whileHover`/`whileTap`) still works normally after adding `layout`.
- **Done when**: neither the expand button nor the map canvas visibly stretches/squishes at any point during the expand/collapse transition, at any playback speed; button press feedback is unaffected; `npm run build` is clean.
