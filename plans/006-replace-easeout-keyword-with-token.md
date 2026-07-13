# 006 — Replace bare 'easeOut' keyword with the EASE_OUT token

- **Status**: DONE
- **Commit**: 0007450
- **Severity**: MEDIUM
- **Category**: Easing & duration / Cohesion & tokens
- **Estimated scope**: 4 files, 5 sites, one-line change each

## Problem

Five card-entrance animations across the app use Framer Motion's built-in `'easeOut'` keyword instead of the repo's own `EASE_OUT` token (`[0.23, 1, 0.32, 1]`, a stronger, more deliberate curve than the generic built-in). Per AUDIT.md category 2: "Built-in CSS easings are too weak for deliberate motion; plans should introduce strong custom curves." Two of the four files already import `EASE_OUT` from `src/lib/motion.js` for other animations in the same file, making the inconsistency a straightforward oversight rather than a deliberate choice.

```jsx
// src/components/CatchGrid/CatchGrid.jsx:68 — current
transition={{ duration: 0.25, ease: 'easeOut', delay: index < 9 ? index * 0.04 : 0 }}
```

```jsx
// src/components/Map/PopupCarousel.jsx:225 — current
transition={{ duration: 0.15, ease: 'easeOut' }}
```

```jsx
// src/pages/SearchPage.jsx:362 — current
transition={{ duration: 0.25, ease: 'easeOut' }}
```

```jsx
// src/pages/UserProfilePage.jsx:785 — current (mobile sheet catches grid)
transition={{ duration: 0.25, ease: 'easeOut' }}
```

```jsx
// src/pages/UserProfilePage.jsx:972 — current (desktop catches grid)
transition={{ duration: 0.25, ease: 'easeOut' }}
```

## Target

Replace the string `'easeOut'` with the imported `EASE_OUT` array constant at all 5 sites. Durations are unchanged — this is an easing-curve swap only.

```jsx
// target — CatchGrid.jsx:68
transition={{ duration: 0.25, ease: EASE_OUT, delay: index < 9 ? index * 0.04 : 0 }}
```

```jsx
// target — PopupCarousel.jsx:225
transition={{ duration: 0.15, ease: EASE_OUT }}
```

```jsx
// target — SearchPage.jsx:362, UserProfilePage.jsx:785, UserProfilePage.jsx:972 (same shape at all three)
transition={{ duration: 0.25, ease: EASE_OUT }}
```

## Repo conventions to follow

- `EASE_OUT` is exported from `src/lib/motion.js:8` as `[0.23, 1, 0.32, 1]`.
- `SearchPage.jsx` and `UserProfilePage.jsx` already import `EASE_OUT` from `../lib/motion.js` for their dialog entrance animations (`SearchPage.jsx` imports `EASE_OUT, EASE_ENTER, EASE_DRAWER`; confirm `UserProfilePage.jsx`'s existing import line and add `EASE_OUT` to it if not already present) — reuse the existing import statement, don't add a duplicate one.
- `CatchGrid.jsx` and `PopupCarousel.jsx` do not currently import anything from `src/lib/motion.js` (`CatchGrid.jsx` imports `SPRING` only) — add `EASE_OUT` to `CatchGrid.jsx`'s existing `motion.js` import, and add a new import line in `PopupCarousel.jsx`.

## Steps

1. In `src/components/CatchGrid/CatchGrid.jsx:8`, change `import { SPRING } from '../../lib/motion.js'` to `import { SPRING, EASE_OUT } from '../../lib/motion.js'`. Then at line 68, change `ease: 'easeOut'` to `ease: EASE_OUT`.
2. In `src/components/Map/PopupCarousel.jsx`, add a new import line `import { EASE_OUT } from '../../lib/motion.js'` near the top with the other imports. Then at line 225, change `ease: 'easeOut'` to `ease: EASE_OUT`.
3. In `src/pages/SearchPage.jsx`, confirm `EASE_OUT` is already imported (it is, per the existing `import { EASE_OUT, EASE_ENTER, EASE_DRAWER } from '../lib/motion.js'` line) — no import change needed. At line 362, change `ease: 'easeOut'` to `ease: EASE_OUT`.
4. In `src/pages/UserProfilePage.jsx`, locate the existing import from `../lib/motion.js` (likely importing `SPRING`, `SPRING_TIGHT`, and possibly others) and add `EASE_OUT` to it if not already present. At lines 785 and 972, change `ease: 'easeOut'` to `ease: EASE_OUT` (both sites, same change).

## Boundaries

- Do NOT change any `duration` value — only the `ease` value, at exactly the 5 sites listed.
- Do NOT touch any other `'easeOut'`, `'ease'`, or similar string anywhere else in these files unless it's one of the 5 sites named above — grep for `'easeOut'` first to confirm you're editing the right occurrences, since some files may have unrelated uses.
- Do NOT modify the CSS Module files — this plan is JS/JSX only.
- If a site's surrounding code has drifted (since commit 0007450) such that the line numbers don't match, locate the target by the exact code snippet shown, not the line number.

## Verification

- **Mechanical**: `npm run build` — expect a clean build with no unused-import or undefined-variable errors.
- **Feel check**: reload the home feed (`CatchGrid`), the search results grid (`SearchPage`), and the profile page's catches grid (`UserProfilePage`, both mobile sheet and desktop) — card entrances should feel slightly snappier/more deliberate (a subtle difference; `EASE_OUT` front-loads the motion more than the generic `easeOut` keyword). Open a map popup and page through photos (`PopupCarousel`) — the image crossfade should feel the same subtle improvement.
  - In DevTools Animations panel, scrub a card entrance at 10% playback and confirm the curve is not linear/symmetric — it should decelerate sharply near the end, characteristic of `cubic-bezier(0.23, 1, 0.32, 1)`.
- **Done when**: all 5 sites use `EASE_OUT`, zero occurrences of the bare string `'easeOut'` remain in these 4 files (verify with `grep -rn "'easeOut'" src/components/CatchGrid/CatchGrid.jsx src/components/Map/PopupCarousel.jsx src/pages/SearchPage.jsx src/pages/UserProfilePage.jsx`), and the build is clean.
