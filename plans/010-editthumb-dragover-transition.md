# 010 — Animate the editThumb drag-over scale pop

- **Status**: DONE
- **Commit**: 0007450
- **Severity**: LOW
- **Category**: Performance / Physicality
- **Estimated scope**: 1 file, 1-line change

## Problem

`.dragOver` sets `transform: scale(1.08)` on a photo thumbnail being dragged over during catch-photo reordering, but `.editThumb`'s `transition` property list doesn't include `transform` — so the scale pop applies instantly instead of animating.

```css
/* src/components/Map/Map.module.css:136-146 — current */
.editThumb {
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  border-radius: 6px;
  overflow: visible;
  cursor: grab;
  border: 2px solid rgba(0,0,0,0.7);
  transition: border-color 0.1s, opacity 0.1s;
  position: relative;
}
```

```css
/* src/components/Map/Map.module.css:194-197 — current */
.dragOver {
  border-color: white;
  transform: scale(1.08);
}
```

## Target

Add `transform 0.1s` to `.editThumb`'s transition list, matching the existing `border-color`/`opacity` durations (0.1s) already on the same rule — this is a rare, low-frequency admin interaction (photo reordering during edit), so a fast, subtle transition consistent with the rest of the thumbnail's existing transitions is appropriate; no new duration budget research needed, just extend the existing pattern.

```css
/* target — src/components/Map/Map.module.css:136-146 */
.editThumb {
  flex-shrink: 0;
  width: 56px;
  height: 56px;
  border-radius: 6px;
  overflow: visible;
  cursor: grab;
  border: 2px solid rgba(0,0,0,0.7);
  transition: border-color 0.1s, opacity 0.1s, transform 0.1s;
  position: relative;
}
```

## Repo conventions to follow

- Multi-property CSS transitions in this file are written as a comma-separated list on one `transition` declaration, matching the existing `border-color 0.1s, opacity 0.1s` shape — append, don't split into a second declaration.

## Steps

1. In `src/components/Map/Map.module.css`, in the `.editThumb` rule (current line 144), change `transition: border-color 0.1s, opacity 0.1s;` to `transition: border-color 0.1s, opacity 0.1s, transform 0.1s;`.

## Boundaries

- Do NOT change `.dragOver`'s `transform: scale(1.08)` value.
- Do NOT touch `.viewThumb` (the non-edit-mode thumbnail strip, current lines 114-123) — it has no drag-over state and is out of scope.
- Do NOT add a `transform` transition to `.thumbRemoveBtn` or any other rule in this file.
- If the CSS has drifted (since commit 0007450) such that `.editThumb`'s transition list differs from the snippet above, append `transform 0.1s` to whatever the current list is rather than overwriting it.

## Verification

- **Mechanical**: `npm run build` — expect a clean build.
- **Feel check**: open a catch dialog you own, enter edit mode, and drag one photo thumbnail over another in the thumbnail strip — the target thumbnail should now visibly grow into its 1.08x scale over ~100ms instead of snapping instantly.
  - In DevTools Animations panel, slow playback to 10% during a drag-over event and confirm the scale change is visible as a short tween, not an instant jump.
- **Done when**: `transform` is included in `.editThumb`'s transition property list, and the drag-over scale pop animates smoothly instead of snapping.
