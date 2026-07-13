# 002 — Add press feedback to CatchGrid cards

- **Status**: DONE
- **Commit**: 0007450
- **Severity**: HIGH
- **Category**: Physicality & origin
- **Estimated scope**: 1 file, 2-line change

## Problem

`CatchCard` is the primary tap target of the home feed — the single highest-frequency interactive element in the app (every card, on every page load, tapped repeatedly per session). It has zero press feedback, while the sibling `.addCard` two lines below it correctly implements `whileTap`/`whileHover`.

```jsx
// src/components/CatchGrid/CatchGrid.jsx:59-69 — current
return (
  <motion.button
    ref={ref}
    className={`${styles.card} ${isActive ? styles.cardActive : ''}`}
    onClick={handleClick}
    onMouseEnter={() => setHoveredPhotoName(leadName)}
    onMouseLeave={() => setHoveredPhotoName(null)}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.25, ease: 'easeOut', delay: index < 9 ? index * 0.04 : 0 }}
  >
```

Compare to the correctly-implemented sibling:

```jsx
// src/components/CatchGrid/CatchGrid.jsx:121-127 — current, for reference only, do not edit in this plan
<motion.button
  className={styles.addCard}
  onClick={() => setUploadOpen(true)}
  whileHover={{ scale: 1.007 }}
  whileTap={{ scale: 0.975 }}
  transition={SPRING}
>
```
(Note: `.addCard`'s `whileHover` value is fixed separately by plan 001 — don't let that plan's value confuse this one. This plan only touches `CatchCard`, lines 59-69.)

## Target

Add `whileTap` press feedback to `CatchCard`, using the repo's standard press-feedback scale (`0.975`, within the AUDIT.md range of 0.95–0.98). Framer Motion lets any animation-target prop (`animate`, `whileTap`, `whileHover`, etc.) carry its own nested `transition` key, which takes priority over the component-level `transition` prop for that specific gesture — so give `whileTap` the shared `SPRING` token directly, leaving the existing entrance `transition` (duration/ease/delay) untouched.

```jsx
// target
return (
  <motion.button
    ref={ref}
    className={`${styles.card} ${isActive ? styles.cardActive : ''}`}
    onClick={handleClick}
    onMouseEnter={() => setHoveredPhotoName(leadName)}
    onMouseLeave={() => setHoveredPhotoName(null)}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    whileTap={{ scale: 0.975, transition: SPRING }}
    transition={{ duration: 0.25, ease: 'easeOut', delay: index < 9 ? index * 0.04 : 0 }}
  >
```

## Repo conventions to follow

- `SPRING` is imported from `src/lib/motion.js` already at `CatchGrid.jsx:8` (`import { SPRING } from '../../lib/motion.js'`) — no new import needed.
- Nested per-gesture `transition` is already used elsewhere in this exact way — see `src/components/CatchDialog/CatchDialog.jsx:67-72`, where `exit` carries its own `transition` distinct from the component-level one.
- Press scale `0.975` matches every other interactive element in this file (`.addCard` at line 125) and across the app (`Button.jsx:11`).

## Steps

1. In `src/components/CatchGrid/CatchGrid.jsx`, inside the `CatchCard` component's returned `motion.button` (starts at line 60), add `whileTap={{ scale: 0.975, transition: SPRING }}` as a new prop, placed after the existing `transition` prop (line 68) for readability. Do not modify the existing `initial`, `animate`, or `transition` props.

## Boundaries

- Do NOT add `whileHover` to `CatchCard` — this plan is press-feedback only (category 3). A hover scale on a card containing an image already has its own hover treatment via `CatchGrid.module.css:44-50` (`.card:hover .image`); don't duplicate or conflict with that CSS-driven hover.
- Do NOT touch `.addCard` in this file — its hover/tap values are handled by plan 001.
- Do NOT modify `CatchGrid.module.css`.
- If the `CatchCard` JSX has drifted from the snippet above (since commit 0007450), STOP and report instead of improvising.

## Verification

- **Mechanical**: `npm run build` — expect a clean build.
- **Feel check**: run the dev server, open the home feed (desktop `/` or mobile web at ≤600px width), and press-and-hold a catch card:
  - The card should visibly compress ~2.5% on press and spring back on release — a clear tactile response.
  - Confirm the existing image `:hover` zoom (CSS, `CatchGrid.module.css:44-50`) still works independently and doesn't visually conflict with the new tap scale.
  - Confirm the entrance stagger (cards fading in with a slight per-card delay on first load) is unaffected — reload the page and watch the first 9 cards animate in with their existing staggered delay.
  - In DevTools Animations panel, slow playback to 10% during a tap and confirm the spring settles smoothly (no snapping/jitter).
- **Done when**: `whileTap={{ scale: 0.975, transition: SPRING }}` is present on `CatchCard`'s `motion.button`, the build is clean, and pressing a card produces visible, springy feedback without disturbing the entrance animation.
