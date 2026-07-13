# 008 — Fix PixelFishLoader's reduced-motion specificity bug

- **Status**: DONE
- **Commit**: 0007450
- **Severity**: MEDIUM
- **Category**: Accessibility (correctness bug)
- **Estimated scope**: 1 file, CSS specificity fix

## Problem

The `assemble` variant of `PixelFishLoader` becomes permanently invisible under `prefers-reduced-motion: reduce`, due to a CSS specificity bug rather than a design gap. This is a real correctness bug in a shared, exported component — currently only exercised via `/design` (the internal dev reference page) but exported for production use (`PixelFishLoader.jsx:77`, `variant = 'wave' | 'assemble'`).

```css
/* src/components/PixelFishLoader.module.css:32-37 — current */
.assemble .pixel {
  opacity: 0;
  transform: scale(0.3);
  animation: pixelPop 420ms cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
  animation-delay: calc(var(--i) * 70ms);
}
```

```css
/* src/components/PixelFishLoader.module.css:54-60 — current */
@media (prefers-reduced-motion: reduce) {
  .pixel {
    animation: none !important;
    opacity: 1;
    transform: none;
  }
}
```

`.assemble .pixel` has specificity (0,2,0) — two classes. The reduced-motion `.pixel` rule has specificity (0,1,0) — one class. Only the `animation` declaration in the reduced-motion block carries `!important`; `opacity: 1` and `transform: none` do not. Per CSS cascade rules, among declarations of equal importance (both non-`!important` here, since `.assemble .pixel`'s `opacity`/`transform` aren't `!important` either — but they don't need to be, since they're competing against non-`!important` rules), specificity decides, and `.assemble .pixel` (0,2,0) beats `.pixel` (0,1,0). The animation is correctly disabled by the `!important`, but the pixels are left frozen at `opacity: 0; transform: scale(0.3)` — invisible — because the reduced-motion block's `opacity: 1`/`transform: none` lose the specificity fight.

## Target

Add `!important` to the two competing declarations in the reduced-motion block, matching the existing `animation: none !important` in the same rule — consistent, not a new pattern.

```css
/* target — src/components/PixelFishLoader.module.css:54-60 */
@media (prefers-reduced-motion: reduce) {
  .pixel {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
  }
}
```

## Repo conventions to follow

- The file already uses `!important` for exactly this purpose one rule below, at `.assemble.fading .pixel` (`PixelFishLoader.module.css:45-48`): `animation: pixelFadeOut 280ms ease forwards !important; animation-delay: 0ms !important;` — overriding a higher-specificity descendant selector is an established pattern in this file, not a new one being introduced.

## Steps

1. In `src/components/PixelFishLoader.module.css`, inside the `@media (prefers-reduced-motion: reduce)` block (current lines 54-60), change `opacity: 1;` to `opacity: 1 !important;` and `transform: none;` to `transform: none !important;`. Leave `animation: none !important;` unchanged.

## Boundaries

- Do NOT change the `.wave` variant's reduced-motion behavior — it isn't affected by this bug (verify: `.wave .pixel`'s animation, at lines 17-20, has no static `opacity`/`transform` override outside the keyframes the way `.assemble .pixel` does, so the existing non-`!important` reduced-motion rule already wins there; this fix targets only the specificity conflict caused by `.assemble .pixel`'s static properties).
- Do NOT touch `pixelPop`, `pixelWave`, or `pixelFadeOut` keyframes.
- Do NOT change `PixelFishLoader.jsx`.
- If the CSS has drifted (since commit 0007450) such that the reduced-motion block no longer matches the snippet above, STOP and report instead of improvising.

## Verification

- **Mechanical**: `npm run build` — expect a clean build (this is a CSS-only change with no build-time validation beyond successful compilation).
- **Feel check**: open `/design`, scroll to the PixelFishLoader section (`DesignPage.jsx:230-244`, both `wave` and `assemble` variants at two sizes each). With DevTools Rendering panel emulating `prefers-reduced-motion: reduce`:
  - The `assemble` variant loaders should now render as fully visible, static, fully-formed pixel fish (not blank/invisible).
  - The `wave` variant loaders should be unaffected (already correct before this fix) — confirm they still render as a static, fully-lit silhouette.
  - Turn off the reduced-motion emulation and confirm both variants animate normally (assemble: pop-in cascade; wave: chasing highlight).
- **Done when**: with reduced motion active, `variant="assemble"` renders visible, non-animated pixels at `opacity: 1`, and normal (non-reduced-motion) behavior is unchanged.
