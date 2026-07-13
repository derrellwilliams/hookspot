# 001 — Fix imperceptible button hover scale across the app

- **Status**: DONE
- **Commit**: 0007450
- **Severity**: HIGH
- **Category**: Physicality & Cohesion
- **Estimated scope**: 5 files, one-line change each

## Problem

`whileHover={{ scale: 1.007 }}` (a 0.7% scale increase) is copy-pasted across five files, including the shared `Button` component used throughout the app. A 0.7% scale change is below the threshold of visible feedback on any normal screen size — it is effectively dead code. Meanwhile other buttons in the same codebase correctly use a visible `1.02` hover scale, proving the intended value was mistyped or miscopied, not a deliberate choice.

```jsx
// src/components/ui/Button.jsx:8-13 — current
<motion.button
  className={`${styles.btn} ${styles[`btn-${variant}`]} ${icon ? styles.btnWithIcon : ''} ${className}`}
  whileHover={disabled ? undefined : { scale: 1.007 }}
  whileTap={disabled ? undefined : { scale: 0.975 }}
  transition={SPRING}
  {...props}
>
```

```jsx
// src/components/Nav/Nav.jsx:62-69 — current
<motion.button
  key={label}
  className={`${styles.navItem} ${isActive ? styles.active : ''}`}
  onClick={() => navigate(itemPath)}
  aria-label={label}
  whileHover={{ scale: 1.007 }}
  whileTap={{ scale: 0.975 }}
  transition={SPRING}
>
```

```jsx
// src/components/FollowListDialog/FollowListDialog.jsx:116-123 — current
<motion.button
  key={id}
  className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
  onClick={() => setActiveTab(id)}
  whileHover={{ scale: 1.007 }}
  whileTap={{ scale: 0.975 }}
  transition={spring}
>
```

```jsx
// src/components/CatchGrid/CatchGrid.jsx:121-127 — current
<motion.button
  className={styles.addCard}
  onClick={() => setUploadOpen(true)}
  whileHover={{ scale: 1.007 }}
  whileTap={{ scale: 0.975 }}
  transition={SPRING}
>
```

```jsx
// src/pages/UserProfilePage.jsx:930-938 — current (desktop profile tab bar)
<motion.button
  key={id}
  className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
  onClick={() => setActiveTab(id)}
  whileHover={{ scale: 1.007 }}
  whileTap={{ scale: 0.975 }}
  transition={SPRING}
>
```

## Target

Every `whileHover={{ scale: 1.007 }}` in the five locations above becomes `whileHover={{ scale: 1.02 }}`. `whileTap={{ scale: 0.975 }}` is already correct (within the AUDIT.md press-feedback range of 0.95–0.98) — do not change it.

```jsx
// target, applied identically at all 5 sites
whileHover={{ scale: 1.02 }}
whileTap={{ scale: 0.975 }}
transition={SPRING}
```

## Repo conventions to follow

- The correct value is already in this codebase — `src/components/Nav/Nav.jsx:45` (`whileHover={{ scale: 1.02 }}` on the logo button) and `Nav.jsx:87` (`whileHover={{ scale: 1.02 }}` on `.addBtn`). Match these exactly.
- `SPRING` (from `src/lib/motion.js:4`, `{ type: 'spring', stiffness: 300, damping: 24 }`) is already the transition used at every site — do not touch it.

## Steps

1. `src/components/ui/Button.jsx:10` — change `{ scale: 1.007 }` to `{ scale: 1.02 }`.
2. `src/components/Nav/Nav.jsx:67` — change `whileHover={{ scale: 1.007 }}` to `whileHover={{ scale: 1.02 }}`.
3. `src/components/FollowListDialog/FollowListDialog.jsx:120` — change `whileHover={{ scale: 1.007 }}` to `whileHover={{ scale: 1.02 }}`.
4. `src/components/CatchGrid/CatchGrid.jsx:124` — change `whileHover={{ scale: 1.007 }}` to `whileHover={{ scale: 1.02 }}`.
5. `src/pages/UserProfilePage.jsx:936` — change `whileHover={{ scale: 1.007 }}` to `whileHover={{ scale: 1.02 }}`.

## Boundaries

- Do NOT change any `whileTap` value — only `whileHover`.
- Do NOT touch the `transition` prop on any of these buttons.
- Do NOT search for and "fix" every `1.007` blindly — confirm each is a `whileHover` scale on a pointer-hoverable element before changing it (there may be unrelated numeric coincidences).
- If a step doesn't match the code you find (drift since commit 0007450), STOP and report instead of improvising.

## Verification

- **Mechanical**: `npm run build` — expect a clean build with no new errors.
- **Feel check**: run the dev server, resize to desktop width (>600px, hover only applies with `hover: hover` capable pointers), and hover over: a primary `Button` (e.g. in a dialog), the desktop `Nav` search/profile icons, the `CatchGrid` "Add catches" tile, and the profile page's "Recent Activity/Stats" tab bar. Confirm each now visibly grows ~2% on hover — a small, clearly perceptible lift, not the previous no-op.
  - In DevTools Animations panel, slow playback to 10% and confirm the scale change is visible frame-by-frame.
- **Done when**: all 5 sites read `scale: 1.02` on hover, the build is clean, and hover feedback is visibly present (not imperceptible) on each of the 4 manually-checked components above.
