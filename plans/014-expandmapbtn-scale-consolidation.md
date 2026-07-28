# 014 — Align expandMapBtn hover/tap scale with the app's button convention

- **Status**: DONE
- **Commit**: 49b7490
- **Severity**: LOW
- **Category**: Cohesion & tokens
- **Estimated scope**: 1 file, one-line change

## Problem

`expandMapBtn`'s hover/tap feedback uses `scale: 1.06` / `scale: 0.92`, which
doesn't match the scale values used by every other icon/action button in the
app.

```jsx
// src/pages/MapPage.jsx:54-55 — current
whileHover={{ scale: 1.06 }}
whileTap={{ scale: 0.92 }}
```

The dominant convention across the codebase is `whileHover={{ scale: 1.02 }}`
/ `whileTap={{ scale: 0.975 }}`, used in:

- `src/components/Nav/Nav.jsx:45-46,67-68,87-88`
- `src/components/ui/Button.jsx:10-11`
- `src/components/CatchGrid/CatchGrid.jsx:145-146`
- `src/components/UploadDialog/UploadDialog.jsx:326-327`
- `src/components/FollowListDialog/FollowListDialog.jsx:118-119`
- `src/pages/UserProfilePage.jsx:919-920`
- `src/pages/DesignPage.jsx:277-278`

`whileTap: 0.92` alone has one precedent — `src/components/MobileNav/MobileNav.jsx:109`,
the mobile "add catch" FAB — but that button has no `whileHover` (mobile, no
hover state) and is a visually larger, more prominent circular affordance
than `expandMapBtn`'s 32px icon button. `expandMapBtn`'s `1.06` hover value
has no precedent anywhere else in the app.

## Target

```jsx
// target — src/pages/MapPage.jsx:54-55
whileHover={{ scale: 1.02 }}
whileTap={{ scale: 0.975 }}
```

## Repo conventions to follow

- `1.02` / `0.975` is the established hover/tap pair for icon and action buttons app-wide — see `src/components/Nav/Nav.jsx:45-46` as the clearest exemplar (a small circular icon button in a glass surface, the closest sibling to `expandMapBtn` in both size and visual treatment).

## Steps

1. In `src/pages/MapPage.jsx:54`, change `whileHover={{ scale: 1.06 }}` to `whileHover={{ scale: 1.02 }}`.
2. In `src/pages/MapPage.jsx:55`, change `whileTap={{ scale: 0.92 }}` to `whileTap={{ scale: 0.975 }}`.

## Boundaries

- Do NOT change `transition={SPRING}` on this button, or any other prop.
- Do NOT touch `MobileNav.jsx`'s FAB button (`0.92` there is left as an intentional exception for that larger, hover-less affordance) — this plan only changes `MapPage.jsx`.
- Do NOT modify `MapPage.module.css`.
- If the two lines have drifted from what's shown above (since commit `49b7490`), STOP and report instead of improvising.

## Verification

- **Mechanical**: `npm run build` — expect a clean build.
- **Feel check**: at a desktop viewport (>600px), hover and click the map's expand button — the scale feedback should feel subtle and consistent with hovering/clicking the top `Nav` bar's icon buttons, not noticeably larger or more aggressive.
- **Done when**: `expandMapBtn`'s `whileHover`/`whileTap` values exactly match `1.02`/`0.975`; no other line in the file changes.
