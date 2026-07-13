# 005 — Consolidate the duplicated {500,38} spring into a shared token

- **Status**: DONE
- **Commit**: 0007450
- **Severity**: MEDIUM
- **Category**: Cohesion & tokens
- **Estimated scope**: 3 files (motion.js, MobileNav.jsx, MapPage.jsx)

## Problem

Two unrelated files independently hand-type the identical spring config, neither importing the shared token module:

```js
// src/components/MobileNav/MobileNav.jsx:15 — current
const stadiumSpring = { type: 'spring', stiffness: 500, damping: 38 }
```

```jsx
// src/pages/MapPage.jsx:58 — current
transition={{ type: 'spring', stiffness: 500, damping: 38 }}
```

Both drive a `layoutId`-based sliding indicator (a stadium/pill highlight behind the active tab/toggle) — the same interaction pattern the existing `SPRING_TIGHT` token was created for (per its own comment, "layoutId indicators (nav highlight, tabs)"), but `SPRING_TIGHT` is `{400, 35}`, a different, softer value already in use for the desktop `Nav` and `UserProfilePage` tab highlights (`Nav.jsx:76`, `UserProfilePage.jsx:945`). This `{500, 38}` value is snappier and used specifically for the two Instagram-style mobile toggle indicators (mobile nav tab stadium, mobile list/map view toggle thumb) — it's a deliberate, distinct value, not a mistake, so it should become its own token rather than being merged into `SPRING_TIGHT`.

## Target

Add a new exported constant to `src/lib/motion.js` and import it in both consumer files.

```js
// target — src/lib/motion.js (add after SPRING_POP, line 6)
export const SPRING_SNAPPY = { type: 'spring', stiffness: 500, damping: 38 } // fast layoutId indicators — mobile stadium/toggle thumbs
```

Remove the local `stadiumSpring` alias entirely and reference `SPRING_SNAPPY` directly at its one use site (no local constant needed).

```jsx
// target — src/components/MobileNav/MobileNav.jsx (JSX use site, was `transition={stadiumSpring}`)
<motion.div
  className={styles.stadium}
  layoutId="mobile-nav-stadium"
  transition={SPRING_SNAPPY}
/>
```

```jsx
// target — src/pages/MapPage.jsx:58
transition={SPRING_SNAPPY}
```

## Repo conventions to follow

- New spring tokens live in `src/lib/motion.js`, exported as `SCREAMING_SNAKE_CASE` constants with a trailing `//` comment describing their use case — follow the exact style of `SPRING`, `SPRING_TIGHT`, `SPRING_POP` (`src/lib/motion.js:4-6`).
- Import style: `import { SPRING_SNAPPY } from '../../lib/motion.js'` (MobileNav, two directories deep) / `'../lib/motion.js'` (MapPage, one directory deep) — match each file's existing relative-import depth.

## Steps

1. In `src/lib/motion.js`, after line 6 (`export const SPRING_POP = ...`), add: `export const SPRING_SNAPPY = { type: 'spring', stiffness: 500, damping: 38 } // fast layoutId indicators — mobile stadium/toggle thumbs`.
2. In `src/components/MobileNav/MobileNav.jsx`:
   - Add `SPRING_SNAPPY` to the imports: this file currently has no import from `src/lib/motion.js` — add a new import line `import { SPRING_SNAPPY } from '../../lib/motion.js'`.
   - Delete the line `const stadiumSpring = { type: 'spring', stiffness: 500, damping: 38 }` (current line 15).
   - Change the JSX use site `transition={stadiumSpring}` (on the `motion.div` with `layoutId="mobile-nav-stadium"`) to `transition={SPRING_SNAPPY}`.
3. In `src/pages/MapPage.jsx`:
   - Add `SPRING_SNAPPY` to the existing import — this file currently has no import from `src/lib/motion.js`; add `import { SPRING_SNAPPY } from '../lib/motion.js'`.
   - Change `transition={{ type: 'spring', stiffness: 500, damping: 38 }}` (current line 58) to `transition={SPRING_SNAPPY}`.

## Boundaries

- Do NOT change `SPRING_TIGHT`'s value or any of its existing use sites (`Nav.jsx:76`, `UserProfilePage.jsx:757,945`, `FollowListDialog.jsx` if applicable) — those are a distinct, correct pattern, not part of this consolidation.
- Do NOT touch any other constant or JSX in `MobileNav.jsx` or `MapPage.jsx` beyond the exact lines named in Steps — this plan is intentionally narrow so it can run independently of plan 003 (which also edits `MobileNav.jsx`, in a different region of the same file).
- If `MobileNav.jsx` or `MapPage.jsx` has already been modified by plan 003 by the time you run this plan, re-locate `stadiumSpring`/the layoutId transition by searching for `layoutId="mobile-nav-stadium"` and `layoutId="feed-view-thumb"` respectively rather than trusting the line numbers above.
- If any step doesn't match the code you find (since commit 0007450), STOP and report instead of improvising.

## Verification

- **Mechanical**: `npm run build` — expect a clean build with no unused-import warnings.
- **Feel check**: at a mobile viewport (≤600px):
  - Tap between the three `MobileNav` tabs — the pill/stadium highlight should slide with the same snap it had before (no perceptible change — this is a refactor, not a retune).
  - On the home page, tap the list/map view toggle — the sliding thumb behind the active icon should feel identical to before.
  - In DevTools Animations panel, confirm both indicators still animate (spring easing visible when scrubbed at 10% playback) rather than snapping instantly (which would indicate the transition prop broke).
- **Done when**: `SPRING_SNAPPY` is the single source of truth in `src/lib/motion.js`, both consumer files import and use it, no local duplicate spring literals remain in either file, and both indicators feel unchanged from before the refactor.
