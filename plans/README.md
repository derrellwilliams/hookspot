# Animation improvement plans

Generated from an `/improve-animations` audit of desktop + mobile web (the React Native app in `mobile/` was out of scope). Plans 001-011 stamped at commit `0007450`; all 11 vetted findings plus one missed-opportunity implementation (directional step slide) were selected and implemented. Plans 012-014 stamped at commit `49b7490`, from a focused audit of the map expand/collapse toggle (`MapPage.jsx`) after its icon/position were changed to match Airbnb's map control.

## Plans

| # | Title | Severity | Status | Files touched |
| --- | --- | --- | --- | --- |
| [001](001-button-hover-scale-fix.md) | Fix imperceptible button hover scale across the app | HIGH | DONE | `Button.jsx`, `Nav.jsx`, `FollowListDialog.jsx`, `CatchGrid.jsx`, `UserProfilePage.jsx` |
| [002](002-catchgrid-card-press-feedback.md) | Add press feedback to CatchGrid cards | HIGH | DONE | `CatchGrid.jsx` |
| [003](003-mobilenav-transform-perf-reduced-motion.md) | MobileNav: transform instead of layout props, + reduced motion | HIGH | DONE | `MobileNav.jsx`, `MobileNav.module.css` |
| [004](004-catchdialog-mobile-sheet-reduced-motion.md) | Respect reduced motion in CatchDialog's mobile sheet | HIGH | DONE | `CatchDialog.jsx` |
| [005](005-consolidate-duplicate-spring-token.md) | Consolidate duplicated {500,38} spring into a shared token | MEDIUM | DONE | `motion.js`, `MobileNav.jsx`, `MapPage.jsx` |
| [006](006-replace-easeout-keyword-with-token.md) | Replace bare 'easeOut' keyword with EASE_OUT token | MEDIUM | DONE | `CatchGrid.jsx`, `PopupCarousel.jsx`, `SearchPage.jsx`, `UserProfilePage.jsx` |
| [007](007-add-grid-entrance-stagger.md) | Add entrance stagger to Search/Profile catch grids | MEDIUM | DONE | `SearchPage.jsx`, `UserProfilePage.jsx` |
| [008](008-fix-pixelfishloader-reduced-motion-bug.md) | Fix PixelFishLoader's reduced-motion specificity bug | MEDIUM | DONE | `PixelFishLoader.module.css` |
| [009](009-followlistdialog-spring-token-fix.md) | Fix FollowListDialog's local spring duplicate/misuse | LOW-MEDIUM | DONE | `FollowListDialog.jsx` |
| [010](010-editthumb-dragover-transition.md) | Animate the editThumb drag-over scale pop | LOW | DONE | `Map.module.css` |
| [011](011-uploaddialog-directional-step-slide.md) | Directional slide for the UploadDialog step wizard | MEDIUM (missed opportunity) | DONE | `UploadDialog.jsx` |
| [012](012-mappane-layout-child-distortion.md) | Fix map pane/button distortion during the expand-map layout animation | HIGH | DONE | `MapPage.jsx`, `MapView.jsx` |
| [013](013-mappage-expand-reduced-motion.md) | Respect reduced motion in the map expand/collapse toggle | MEDIUM | DONE | `MapPage.jsx` |
| [014](014-expandmapbtn-scale-consolidation.md) | Align expandMapBtn hover/tap scale with the app's button convention | LOW | DONE | `MapPage.jsx` |

Plans 001-011 were implemented in the order below on top of commit `0007450`, uncommitted in the working tree — `npm run build` is clean. Not yet feel-checked in a browser (see each plan's Verification section for what to check); CLAUDE.md requires a desktop 1440px screenshot check before committing mobile-web changes.

Plans 012-014 were implemented in numeric order on top of commit `49b7490`, uncommitted in the working tree — `npm run build` is clean, diffs reviewed against each plan's Boundaries with no drift or scope creep. Not yet feel-checked in a browser — in particular, plan 012's fix (adding `layout` to `expandMapBtn` and `MapView`'s root `div`) should be eyeballed at slowed-down playback per its Verification section before treating the distortion as confirmed-fixed rather than just mechanically-applied.

## Recommended execution order

1. **001** — touches the most files; get it out of the way first so later plans that touch the same files (002, 006, 009) start from a clean base.
2. **002** — same file as 001 (`CatchGrid.jsx`), different lines; sequential is safest.
3. **006** — same file as 002 (`CatchGrid.jsx`) and also touches `SearchPage.jsx`/`UserProfilePage.jsx`, which 007 depends on.
4. **007** — depends on 006 having landed in `SearchPage.jsx`/`UserProfilePage.jsx` (the plan handles either order, but running after 006 avoids the ease-value branch entirely).
5. **005** — adds the `SPRING_SNAPPY` token; touches `MobileNav.jsx` and `MapPage.jsx`.
6. **003** — also touches `MobileNav.jsx`, in a different region than 005; order-agnostic with 005, but listed after so the token exists first if you're eyeballing diffs.
7. **004** — independent (`CatchDialog.jsx` only).
8. **008** — independent (`PixelFishLoader.module.css` only).
9. **009** — touches `FollowListDialog.jsx`, which 001 also touches (different lines); run after 001 so the `whileHover` value is already settled.
10. **010** — fully independent (`Map.module.css` only).
11. **011** — fully independent (`UploadDialog.jsx` only, no other plan touches this file); can run any time, listed last since it's the one new pattern (directional variants) rather than a fix to existing code.

**Dependencies summary**: 007 soft-depends on 006. 009 soft-depends on 001. 003 and 005 both touch `MobileNav.jsx` but in disjoint regions — safe in either order. Everything else is independent and can run in parallel if you're dispatching multiple executors.

### 012-014 (map expand toggle)

12. **012** — touches `MapPage.jsx` (adds `layout` to `expandMapBtn`) and `MapView.jsx` (converts the root `div` to `motion.div`); run before 014 since both touch `expandMapBtn`'s JSX region, avoiding a merge on the same lines.
13. **013** — touches `MapPage.jsx` (`.cardsPane`/`.mapPane` `layout` props, different lines than 012/014) — order-agnostic with 012 and 014, but listed after 012 since both add hooks/props near the top of the component.
14. **014** — touches `MapPage.jsx:54-55` only (`expandMapBtn`'s `whileHover`/`whileTap`) — independent of 012/013's lines, but run last since 012 also edits `expandMapBtn`'s opening tag.

**Dependencies summary**: 012, 013, 014 all touch `MapPage.jsx` but on disjoint lines/props — safe to run sequentially in numeric order (as listed above) to avoid any diff overlap surprises; none are a hard dependency of another.

## Documented opportunities (not planned)

Three additional category-8 "missed opportunity" findings from the audit were not turned into plans — the user asked to try out and implement only the UploadDialog directional slide (plan 011). These remain documented here for future consideration:

- **`src/pages/MapPage.jsx:36-40`** — the wordmark teleports between two entirely different elements (`.feedLogo`, inline with the feed; `.feedLogoOverlay`, absolutely positioned) on every mobile list/map toggle tap, with zero transition. A shared `layoutId` or a brief opacity/transform tween would smooth this.
- **`src/pages/LoginPage.module.css` / `src/pages/OnboardingPage.module.css`** — zero motion anywhere on these rare, once-per-user screens. Neither imports `motion`/`AnimatePresence`; no CSS `animation`/`transition` on the card containers either. These are exactly the "rare, high-emotion, can add delight" case AUDIT.md category 8 calls out, currently unused.
- **`src/components/CatchGrid/CatchGrid.jsx:115-119`** — the very first upload flips `hasPhotos` and swaps the welcome/empty message for the populated grid with a hard cut, no crossfade, on what is a rare and emotionally significant first-run moment.

If any of these become worth doing, they can be written up as plans using the same format — each already has enough file:line detail above to specify one directly.
