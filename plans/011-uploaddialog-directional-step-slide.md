# 011 — Directional slide for the UploadDialog step wizard

- **Status**: DONE
- **Commit**: 0007450
- **Severity**: MEDIUM (missed opportunity — category 8)
- **Category**: Missed opportunities
- **Estimated scope**: 1 file (UploadDialog.jsx), moderate — touches step-transition state and JSX

## Problem

`UploadDialog` is a literal 3-step linear wizard (drop/select photos → pin location on map if no GPS → fill in species/rod/fly) with explicit Back/Next buttons, but every step transition uses the same undirected opacity-only fade, with no cue for which direction the user is moving:

```jsx
// src/components/UploadDialog/UploadDialog.jsx:23 — current
const STEP_FADE = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.15 } }
```

```jsx
// src/components/UploadDialog/UploadDialog.jsx:291-392 — current (structure; full detail below in Steps)
<AnimatePresence mode="wait" initial={false}>
  {step === 1 && (
    <motion.div key="step-1" {...STEP_FADE}>
      {/* drop zone */}
    </motion.div>
  )}
  {step === 2 && (
    <motion.div key="step-2" {...STEP_FADE} className={styles.locationStep}>
      {/* map pin */}
      <Button variant="secondary" onClick={() => { setStep(1); setManualPin(null) }}>Back</Button>
      <Button variant="primary" onClick={() => setStep(3)} disabled={!manualPin}>Next</Button>
    </motion.div>
  )}
  {step === 3 && (
    <motion.div key="step-3" {...STEP_FADE}>
      {/* species/rod/fly form */}
    </motion.div>
  )}
</AnimatePresence>
```

All five `setStep(...)` call sites:

```jsx
// src/components/UploadDialog/UploadDialog.jsx:44 — current (useState declaration)
const [step, setStep] = useState(1)
```

```jsx
// src/components/UploadDialog/UploadDialog.jsx:109 — current (inside close(), dialog is closing — not user-visible)
setStep(1)
```

```jsx
// src/components/UploadDialog/UploadDialog.jsx:132 — current (inside goToNextStep(), forward: 1 → 2 or 1 → 3, visible)
setStep(hasGps ? 3 : 2)
```

```jsx
// src/components/UploadDialog/UploadDialog.jsx:152 — current (inside removeThumb(), backward: N → 1 when all photos removed, visible)
if (!newFiles.length) { setStep(1); setPendingFiles([]); setPendingBlobs([]); setPendingUrls([]); return }
```

```jsx
// src/components/UploadDialog/UploadDialog.jsx:348 — current (Back button, backward: 2 → 1, visible)
<Button variant="secondary" onClick={() => { setStep(1); setManualPin(null) }}>Back</Button>
```

```jsx
// src/components/UploadDialog/UploadDialog.jsx:349 — current (Next button, forward: 2 → 3, visible)
<Button variant="primary" onClick={() => setStep(3)} disabled={!manualPin}>Next</Button>
```

Upload is a core-loop action (per this repo's own CLAUDE.md test-fixture guidance, calling out the upload flow specifically), making this the highest-value "missing motion" opportunity in the app.

## Target

Track a `direction` value (`1` = forward, `-1` = backward) alongside `step`, updated by a single wrapper function so every call site that changes steps automatically records the right direction. Replace `STEP_FADE` with Framer Motion's `custom`-prop variants pattern, sliding the exiting step out and the entering step in from the correct side, using percentage-based `x` offsets (not hardcoded pixels) per this app's own convention of favoring relative units for slide-style motion (see `CatchDialog.jsx`'s `y: '100%'` sheet slide, which uses percentage, not px). Keep the duration inside the existing UI budget (150–250ms, matching "dropdowns/selects" in AUDIT.md's duration table, since this is a same-dialog content swap, not a full modal open/close) and use `EASE_OUT` for both the entering and exiting step, per AUDIT.md's easing decision order ("Entering or exiting → ease-out").

```jsx
// target — src/components/UploadDialog/UploadDialog.jsx:23 (replaces STEP_FADE)
const STEP_SLIDE_DISTANCE = '6%'
const stepVariants = {
  enter: (direction) => ({ opacity: 0, x: direction > 0 ? STEP_SLIDE_DISTANCE : `-${STEP_SLIDE_DISTANCE}` }),
  center: { opacity: 1, x: 0 },
  exit: (direction) => ({ opacity: 0, x: direction > 0 ? `-${STEP_SLIDE_DISTANCE}` : STEP_SLIDE_DISTANCE }),
}
const STEP_TRANSITION = { duration: 0.2, ease: EASE_OUT }
```

```jsx
// target — src/components/UploadDialog/UploadDialog.jsx:44 (useState — step setter renamed, direction added)
const [step, setStepRaw] = useState(1)
const [stepDirection, setStepDirection] = useState(1)
```

Add a new function near the other step-related helpers (e.g. right after the `close()`/`goToNextStep()` functions, or immediately below the `useState` declarations — either is fine since it only depends on `step`):

```jsx
// target — new function, place after the useState declarations
function goToStep(next) {
  setStepDirection(next > step ? 1 : -1)
  setStepRaw(next)
}
```

Update all visible (user-facing) call sites to use `goToStep` instead of `setStep`; leave the dialog-close reset as a direct, undirected `setStepRaw` since it's not a visible transition (the dialog is unmounting):

```jsx
// target — line 109 (inside close()) — direction doesn't matter, dialog is closing
setStepRaw(1)
```

```jsx
// target — line 132 (inside goToNextStep())
goToStep(hasGps ? 3 : 2)
```

```jsx
// target — line 152 (inside removeThumb())
if (!newFiles.length) { goToStep(1); setPendingFiles([]); setPendingBlobs([]); setPendingUrls([]); return }
```

```jsx
// target — line 348 (Back button)
<Button variant="secondary" onClick={() => { goToStep(1); setManualPin(null) }}>Back</Button>
```

```jsx
// target — line 349 (Next button)
<Button variant="primary" onClick={() => goToStep(3)} disabled={!manualPin}>Next</Button>
```

Update the `AnimatePresence` and each step's `motion.div` to use the new variants with `custom`:

```jsx
// target — src/components/UploadDialog/UploadDialog.jsx:291-392 (structure)
<AnimatePresence mode="wait" initial={false} custom={stepDirection}>
  {step === 1 && (
    <motion.div key="step-1" custom={stepDirection} variants={stepVariants} initial="enter" animate="center" exit="exit" transition={STEP_TRANSITION}>
      {/* drop zone — unchanged */}
    </motion.div>
  )}
  {step === 2 && (
    <motion.div key="step-2" custom={stepDirection} variants={stepVariants} initial="enter" animate="center" exit="exit" transition={STEP_TRANSITION} className={styles.locationStep}>
      {/* map pin — unchanged, including Back/Next buttons updated above */}
    </motion.div>
  )}
  {step === 3 && (
    <motion.div key="step-3" custom={stepDirection} variants={stepVariants} initial="enter" animate="center" exit="exit" transition={STEP_TRANSITION}>
      {/* species/rod/fly form — unchanged */}
    </motion.div>
  )}
</AnimatePresence>
```

## Repo conventions to follow

- Percentage-based translate offsets for slide motion (not hardcoded px): mirrors `CatchDialog.jsx:65-68`'s `y: '100%'` sheet slide.
- `EASE_OUT` import: already imported in this file (`UploadDialog.jsx:21`, `import { SPRING, EASE_OUT, EASE_ENTER } from '../../lib/motion.js'`) — no new import needed.
- Framer Motion's `custom` prop + variant-function pattern (`(direction) => ({...})`) is the standard library idiom for direction-aware `AnimatePresence` transitions — this introduces the pattern to the codebase for the first time, so name things clearly (`stepVariants`, `stepDirection`) since there's no existing local exemplar to match.

## Steps

1. Replace the `STEP_FADE` constant (current line 23) with the `STEP_SLIDE_DISTANCE`, `stepVariants`, and `STEP_TRANSITION` constants shown in Target.
2. Change the `useState` declaration (current line 44) from `const [step, setStep] = useState(1)` to `const [step, setStepRaw] = useState(1)` and add a new line immediately after: `const [stepDirection, setStepDirection] = useState(1)`.
3. Add the `goToStep(next)` function shown in Target, placed after the `close()` function definition (which ends at current line 111).
4. In `close()` (current line 109), change `setStep(1)` to `setStepRaw(1)`.
5. In `goToNextStep()` (current line 132), change `setStep(hasGps ? 3 : 2)` to `goToStep(hasGps ? 3 : 2)`.
6. In `removeThumb()` (current line 152), change `setStep(1)` to `goToStep(1)` (keep the rest of that line's statements — `setPendingFiles([]); setPendingBlobs([]); setPendingUrls([]); return` — unchanged).
7. In the Back button's `onClick` (current line 348), change `setStep(1)` to `goToStep(1)`.
8. In the Next button's `onClick` (current line 349), change `setStep(3)` to `goToStep(3)`.
9. On each of the three step `motion.div` elements (current lines 293, 338, 356), replace the `{...STEP_FADE}` spread with `custom={stepDirection} variants={stepVariants} initial="enter" animate="center" exit="exit" transition={STEP_TRANSITION}`.
10. Add `custom={stepDirection}` to the `<AnimatePresence mode="wait" initial={false}>` tag (current line 291), making it `<AnimatePresence mode="wait" initial={false} custom={stepDirection}>`.

## Boundaries

- Do NOT change any content inside the three step `motion.div` bodies (drop zone, map, form) beyond the `onClick` handlers named in Steps 5-8 — this plan is a transition-mechanics change only.
- Do NOT change `mode="wait"` on `AnimatePresence` — the wizard should still fully exit the old step before mounting the new one (this is what makes the directional slide read clearly: old step slides out first, then new step slides in from the opposite side).
- Do NOT touch the outer dialog's own entrance/exit animation (`motion.div` with `className={styles.content}`, current lines 279-284) — that's the dialog-level open/close, a separate concern from the in-dialog step transitions.
- Do NOT add slide motion to the backdrop.
- Do NOT change `STEP_TRANSITION`'s duration below 150ms or above 250ms (AUDIT.md's dropdown/select budget) without re-checking AUDIT.md — 200ms is the target value, chosen as the midpoint.
- If any of the 5 `setStep` call sites or 3 `motion.div` step blocks have drifted (since commit 0007450) such that they don't match the snippets above, locate them by searching for `setStep(` and `key="step-` respectively, and apply the equivalent change based on whether each call site is a visible (forward/backward) transition or an invisible reset (dialog closing) — err toward `goToStep` for anything the user can see happen.

## Verification

- **Mechanical**: `npm run build` — expect a clean build, and confirm `grep -n "setStep(" src/components/UploadDialog/UploadDialog.jsx` returns zero results (all call sites should now be `setStepRaw` or `goToStep`).
- **Feel check**: open the upload dialog (the "+" button), and:
  - Select photos without GPS data (or use a test image known to lack EXIF GPS) to land on step 2 (location pin) — the drop-zone step should slide out to the left while the map step slides in from the right.
  - Click "Back" on step 2 — the map step should slide out to the right while the drop-zone step slides in from the left (the exact mirror of the forward transition).
  - Place a pin and click "Next" to reach step 3 (species form) — same forward slide-from-right behavior.
  - Remove all photos on step 3 via the thumb strip until the dialog resets to step 1 — should slide in from the left (backward), since removing all photos is conceptually a "back to start" action.
  - Close and reopen the dialog — no slide artifact on open (the dialog-level entrance is untouched, and step resets to 1 via the undirected `setStepRaw`).
  - In DevTools Animations panel, slow playback to 10% on a forward and a backward transition and confirm: (a) the old step visibly translates in the correct direction while fading out, (b) the new step enters from the correct opposite side while fading in, (c) there's no visible flash of both steps' full-opacity content overlapping (since `mode="wait"` sequences them).
- **Done when**: all 3 step transitions (1↔2, 2↔3, and the removeThumb-triggered reset to 1) slide directionally and correctly, `STEP_FADE`/`setStep` no longer exist in the file, and the build is clean.
