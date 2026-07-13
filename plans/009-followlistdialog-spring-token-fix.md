# 009 — Fix FollowListDialog's local spring duplicate and token misuse

- **Status**: DONE
- **Commit**: 0007450
- **Severity**: LOW-MEDIUM
- **Category**: Cohesion & tokens
- **Estimated scope**: 1 file, small change

## Problem

`FollowListDialog.jsx` hand-types a local spring that exactly duplicates `SPRING_TIGHT` from the shared token module, without importing it — and then uses that duplicate for a `whileHover`/`whileTap` gesture, which `src/lib/motion.js`'s own comment reserves `SPRING_TIGHT` against (`"layoutId indicators (nav highlight, tabs)"`). The correct token for hover/tap gestures is `SPRING` (`{300, 24}`, commented `"default interactive spring (hover/tap)"`).

```jsx
// src/components/FollowListDialog/FollowListDialog.jsx:10 — current
const spring = { type: 'spring', stiffness: 400, damping: 35 }
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
// src/components/FollowListDialog/FollowListDialog.jsx:124-129 — current
{isActive && (
  <motion.div
    layoutId="follow-tab-highlight"
    className={styles.tabHighlight}
    initial={false}
    transition={animateTabs ? spring : { duration: 0 }}
```

The local `spring` constant is actually used correctly at its second call site (line 129, a `layoutId` indicator — exactly what `SPRING_TIGHT` is for) but incorrectly at the first (line 122, a `whileHover`/`whileTap` gesture — should be `SPRING`). Both call sites currently share the same wrong-for-one-of-them value because they both reference the same local alias.

## Target

Remove the local `spring` constant, import both `SPRING` and `SPRING_TIGHT` from the shared token module, and use each at the call site matching its documented purpose.

```jsx
// target — src/components/FollowListDialog/FollowListDialog.jsx:1-10 (imports)
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import * as Dialog from '@radix-ui/react-dialog'
import { supabase } from '../../lib/supabase.js'
import { UserRow } from '../UserRow/UserRow.jsx'
import { EASE_OUT, EASE_ENTER, SPRING, SPRING_TIGHT } from '../../lib/motion.js'
import styles from './FollowListDialog.module.css'
```

(The local `const spring = { type: 'spring', stiffness: 400, damping: 35 }` line is deleted entirely.)

```jsx
// target — line ~120 (whileHover/whileTap on the tab button)
<motion.button
  key={id}
  className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
  onClick={() => setActiveTab(id)}
  whileHover={{ scale: 1.007 }}
  whileTap={{ scale: 0.975 }}
  transition={SPRING}
>
```

```jsx
// target — line ~129 (layoutId indicator)
{isActive && (
  <motion.div
    layoutId="follow-tab-highlight"
    className={styles.tabHighlight}
    initial={false}
    transition={animateTabs ? SPRING_TIGHT : { duration: 0 }}
```

Note: the `whileHover={{ scale: 1.007 }}` value at this same site is also fixed (to `1.02`) by plan 001 — if plan 001 has already run when you apply this plan, preserve its `1.02` value; only change the `transition` prop in this plan, not `whileHover`.

## Repo conventions to follow

- `SPRING` / `SPRING_TIGHT` import path and naming: `src/lib/motion.js:4-5`, already imported this way in `src/components/Nav/Nav.jsx:7` (`import { SPRING, SPRING_TIGHT } from '../../lib/motion.js'`) — match that exact import shape (adjusted for this file's relative path, `../../lib/motion.js`, same depth as Nav.jsx).
- `FollowListDialog.jsx` already imports `EASE_OUT, EASE_ENTER` from the same module (`FollowListDialog.jsx:7`) — extend that existing import line rather than adding a second one.

## Steps

1. In `src/components/FollowListDialog/FollowListDialog.jsx:7`, change `import { EASE_OUT, EASE_ENTER } from '../../lib/motion.js'` to `import { EASE_OUT, EASE_ENTER, SPRING, SPRING_TIGHT } from '../../lib/motion.js'`.
2. Delete line 10: `const spring = { type: 'spring', stiffness: 400, damping: 35 }`.
3. At the tab button's `whileHover`/`whileTap`/`transition` (current line 122), change `transition={spring}` to `transition={SPRING}`. Do not touch `whileHover`/`whileTap` themselves (see note above about plan 001).
4. At the `layoutId="follow-tab-highlight"` indicator (current line 129), change `transition={animateTabs ? spring : { duration: 0 }}` to `transition={animateTabs ? SPRING_TIGHT : { duration: 0 }}`.

## Boundaries

- Do NOT change the `animateTabs` conditional logic or the `{ duration: 0 }` fallback — only the `spring` reference itself.
- Do NOT touch `whileHover`/`whileTap` scale values — those belong to plan 001.
- Do NOT modify `FollowListDialog.module.css`.
- Do NOT touch the dialog's backdrop or panel entrance animations (lines ~92-107) — out of scope for this plan (see finding #3/#4 from the original audit if those are addressed in a future plan; they are not part of this one).
- If the file has drifted (since commit 0007450) such that `spring` is referenced at different line numbers or additional sites, search for all occurrences of the identifier `spring` in this file and update each one to either `SPRING` or `SPRING_TIGHT` per its usage (gesture feedback → `SPRING`; `layoutId` indicator → `SPRING_TIGHT`), rather than assuming exactly 2 call sites.

## Verification

- **Mechanical**: `npm run build` — expect a clean build with no unused-import or undefined-variable errors, and confirm `grep -n "const spring" src/components/FollowListDialog/FollowListDialog.jsx` returns nothing.
- **Feel check**: open the Followers/Following dialog (from a profile page's follower count), switch between the "Followers" and "Following" tabs a few times:
  - The sliding highlight behind the active tab should feel identical to before (same spring value, just sourced from the shared token now).
  - Hover and tap the tab buttons — feedback should feel identical to before.
- **Done when**: no local `spring` constant remains in the file, `SPRING` is used for the hover/tap transition and `SPRING_TIGHT` for the `layoutId` indicator, and both interactions feel unchanged from before the refactor.
