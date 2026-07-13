# 007 — Add entrance stagger to Search/Profile catch grids

- **Status**: DONE
- **Commit**: 0007450
- **Severity**: MEDIUM
- **Category**: Cohesion & tokens
- **Estimated scope**: 2 files, 3 sites

## Problem

`CatchGrid.jsx`'s own card entrance already implements a stagger (`delay: index < 9 ? index * 0.04 : 0` — a 40ms-per-card delay, capped at the first 9 cards), but the visually identical card pattern reused in `SearchPage.jsx` and `UserProfilePage.jsx` (both grids import and render `cardStyles.card`, the same CSS class) fades every card in simultaneously with no delay. Per AUDIT.md category 7: "Everything-at-once group entrances where a 30–80ms stagger belongs."

```jsx
// src/components/CatchGrid/CatchGrid.jsx:68 — current, for reference (correct pattern, do not edit — see plan 006 for the ease fix on this same line)
transition={{ duration: 0.25, ease: 'easeOut', delay: index < 9 ? index * 0.04 : 0 }}
```

```jsx
// src/pages/SearchPage.jsx:355-363 — current
{visibleCatches.map((group, i) => {
  const lead = group.find(p => p.species) ?? group[0]
  const species = cleanSpecies(lead.species)
  const locationStr = formatCatchLocation(lead.meta)
  const owner = group[0].ownerProfile
  const flatIdx = (anglersVisible ? userResults.length : 0) + i
  const ownerName = owner?.display_name || owner?.username
  return (
    <motion.button
      key={group[0].name}
      ref={el => { itemRefs.current[flatIdx] = el }}
      className={`${cardStyles.card} ${activeIdx === flatIdx ? cardStyles.cardActive : ''}`}
      onClick={() => openCatch(i)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
```

```jsx
// src/pages/UserProfilePage.jsx:966-973 — current (desktop catches grid)
{visibleCatches.map((group, i) => {
  const lead = group.find(p => p.species) ?? group[0]
  const species = cleanSpecies(lead.species)
  const locationStr = formatCatchLocation(lead.meta)
  return (
    <motion.button
      key={group[0].name}
      className={cardStyles.card}
      onClick={() => setCatchPopupIdx(i)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
```

```jsx
// src/pages/UserProfilePage.jsx:779-786 — current (mobile sheet catches grid, same shape)
{visibleCatches.map((group, i) => {
  const lead = group.find(p => p.species) ?? group[0]
  const species = cleanSpecies(lead.species)
  const locationStr = formatCatchLocation(lead.meta)
  return (
    <motion.button
      key={group[0].name}
      className={cardStyles.card}
      onClick={() => setCatchPopupIdx(i)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
```

## Target

Apply the exact same stagger formula CatchGrid already uses — `index < 9 ? index * 0.04 : 0` (40ms per card, capped at the first 9) — to all 3 sites, using each site's loop-local index variable (`i` in all three cases).

```jsx
// target — SearchPage.jsx:362
transition={{ duration: 0.25, ease: 'easeOut', delay: i < 9 ? i * 0.04 : 0 }}
```

```jsx
// target — UserProfilePage.jsx:972 (desktop) and :785 (mobile sheet) — same shape at both
transition={{ duration: 0.25, ease: 'easeOut', delay: i < 9 ? i * 0.04 : 0 }}
```

Note: if plan 006 (bare `'easeOut'` → `EASE_OUT` token) has already run on these files, the `ease` value in your target should be `EASE_OUT` instead of `'easeOut'` — match whatever the file currently has for `ease` and only add the `delay` key; do not revert an already-applied `EASE_OUT` change.

## Repo conventions to follow

- The stagger formula, its 9-card cap, and the 40ms step are established at `src/components/CatchGrid/CatchGrid.jsx:68` — copy it exactly, don't invent a different cap or step value.
- All 3 target sites already have a loop index variable named `i` in scope (`SearchPage.jsx`'s `.map((group, i) => ...)`, `UserProfilePage.jsx`'s `.map((group, i) => ...)` in both grids) — use `i` directly, matching `CatchGrid.jsx`'s `index` parameter name pattern (just a different local name for the same role).

## Steps

1. In `src/pages/SearchPage.jsx`, at the `motion.button` inside the `visibleCatches.map` callback (current line 362), change `transition={{ duration: 0.25, ease: 'easeOut' }}` to `transition={{ duration: 0.25, ease: 'easeOut', delay: i < 9 ? i * 0.04 : 0 }}` (or with `EASE_OUT` if plan 006 already ran — see Target note above).
2. In `src/pages/UserProfilePage.jsx`, at the desktop catches grid's `motion.button` (current line 972), make the same change: add `delay: i < 9 ? i * 0.04 : 0` to the transition object.
3. In `src/pages/UserProfilePage.jsx`, at the mobile sheet catches grid's `motion.button` (current line 785), make the same change: add `delay: i < 9 ? i * 0.04 : 0` to the transition object.

## Boundaries

- Do NOT change the stagger formula, cap, or step (`0.04`) — copy `CatchGrid.jsx`'s values exactly, do not tune them differently for these grids.
- Do NOT add a stagger to the skeleton-loading grids (`Array.from({ length: 8 }, ...)` / `Array.from({ length: 6 }, ...)` in `UserProfilePage.jsx`) — those render placeholder cards, not real content, and are out of scope.
- Do NOT touch `CatchGrid.jsx` in this plan — it's already correct and is reference-only here.
- Do NOT change `duration` or `ease` (beyond what plan 006 already changes) — `delay` is the only new key being added.
- If any site's code has drifted (since commit 0007450) such that the loop variable isn't named `i`, use whatever the actual loop variable is named instead of assuming `i`.

## Verification

- **Mechanical**: `npm run build` — expect a clean build.
- **Feel check**: 
  - Run a search query on `/search` that returns 10+ catches — the results grid should fade in with a visible left-to-right, top-to-bottom cascade for the first 9 cards, then the rest appear together (matching CatchGrid's exact cap behavior).
  - Visit a profile page with 10+ catches, both on desktop (wide viewport) and as the mobile bottom sheet (≤600px) — same staggered cascade should appear in both.
  - Confirm the stagger never blocks interaction — try clicking a card during the entrance animation and confirm the click registers immediately (Framer Motion's `initial`/`animate` opacity tween doesn't block pointer events, so this should already work, but verify no `pointer-events: none` was accidentally introduced).
- **Done when**: all 3 grids show the same 40ms-cascade stagger (capped at 9) that `CatchGrid.jsx` already has, and the build is clean.
