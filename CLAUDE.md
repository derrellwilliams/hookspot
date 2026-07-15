# Hook Spot — Claude Guidelines

## Tech Stack
- **React 19** + Vite 5 (`@vitejs/plugin-react@4` — do NOT upgrade to v5/v6)
- **Zustand v5**: `src/store/usePhotoStore.js`, `src/store/useAuthStore.js`
- **React Router 7** (`BrowserRouter`); routes: `/` (MapPage), `/login`, `/onboarding`, `/user/:username`, `/profile` (redirect), `/search`, `/design`
- **Supabase** auth + storage + database (`src/lib/supabase.js`)
- **Mapbox GL JS** (raw, no react-map-gl); popups use `createRoot(el).render(<PopupCarousel/>)`
- **Radix UI** for modals, dropdowns, tooltips; **lucide-react** icons via `src/components/icons.js` (mobile: `lucide-react-native` via `mobile/components/icons.js`)
- **CSS Modules** + CSS custom properties; tokens in `src/tokens.js` mirror `src/style.css`

## Key Files
- **Entry**: `src/main.jsx` → `src/App.jsx`
- **Pages**: `src/pages/` — MapPage, LoginPage, OnboardingPage, UserProfilePage, SearchPage, DesignPage, NotFoundPage, FeedPage (WIP, unrouted)
- **Components**: `src/components/` — Map, CatchGrid, CatchDialog, Nav (desktop), MobileNav (mobile web), UploadDialog, DropOverlay, FavoritePicker, FollowListDialog, Toast, UserRow, PixelFishLoader, ui/; root-level `DitherMesh.jsx`, `RequireAuth.jsx`, `ErrorBoundary.jsx`, `icons.js`
- **Orphans** (unused since the 2026-07-11 dock removal, safe to delete): `src/components/Sidebar/`, `src/hooks/useSafeAreaInsets.js`
- **Stores**: `usePhotoStore` (photos, groups, flyToPhoto, activeGroup, toast, uploadOpen, bulkUploading, pendingUploadFiles, ownOnly, photosInitialized); `useAuthStore` (user, session, username, loading)
- **Lib**: `src/lib/` — fileLoader.js, groupPhotos.js, groupByTime.js, formatters.js, supabase.js, geocode.js, weather.js, waterbody.js, validation.js, imageUtils.js, mapbox.js, avatarUpload.js, motion.js
- **Utilities**: `src/cache.js` (IndexedDB), `src/exif.js`, `src/identify.js`, `src/stats.js` — keep pure (no React)
- **API**: Vite middleware in `vite.config.js` — `/identify` (Claude AI via Anthropic SDK, requires `ANTHROPIC_API_KEY`), `/api/check-username`, `/api/save-profile`, `/api/profile`, `/api/photos`, `/api/search-users`, `/api/search-catches`

## Data Model
- **`catches`** — one row per fishing session: `id, user_id, species, rod, fly, lat, lng, time`
- **`photos`** — one row per image: `catch_id (FK → catches)`, `filename, storage_path, url, thumb_url, species, lat, lng, time, meta`
- Every upload creates a `catches` row first, then inserts photos with that `catch_id`
- `thumb_url` is a best-effort ~960px grid thumbnail (`resizeForThumb()` in `src/exif.js`, uploaded by `uploadThumbnail()` in `src/lib/fileLoader.js`) generated alongside the full 2048px original on every upload. `CatchCard` (`src/components/CatchGrid/CatchGrid.jsx`) renders `thumbUrl ?? url`, so photos without a thumbnail (pre-2026-07-15) just fall back to the full image. `scripts/backfill-thumbnails.js` (pass `--force` to regenerate existing thumbnails) backfills photos uploaded before this existed.
- **Thumbnail generation must stay sequential and best-effort** — it runs strictly after the main image upload succeeds, wrapped in try/catch, and `thumb_url` is only included in the insert when generation actually succeeded. A 2026-06 attempt ran both uploads in parallel and always sent `thumb_url` (even as `null`), which broke every upload in production — don't reintroduce either pattern.
- `groupPhotos(photos)` in `src/lib/groupPhotos.js` groups by `catchId`; photos with no `catchId` become singleton groups
- `PopupCarousel.saveEdit()` writes edits to both `photos` and `catches` to keep them in sync

## Architecture
- `PopupCarousel` runs in its own React root inside Mapbox popup DOM; unmount on popup close to prevent leaks
- `DropOverlay` listens globally to drag events; on drop it sets `pendingUploadFiles` + opens `UploadDialog` — all uploads go through one flow
- `src/cache.js` — IndexedDB `fishmap-cache` caches photo blobs + EXIF keyed by `{userId}/{filename}`; fileLoader checks cache before network

## Mobile Web (≤600px)
- Breakpoint: `@media (max-width: 600px)` in CSS, `useIsMobile()`/`MOBILE_QUERY` from `src/hooks/useIsMobile.js` in JS. Desktop >600px keeps the top glass `Nav` + split-pane layouts and must never be affected by mobile changes.
- `MobileNav` (`src/components/MobileNav/`) replaces the old dock (removed 2026-07-11, revert via `git revert -m 1 9bdfd6a`): Instagram-style floating icon pill (Home/Profile/Search, cell-wide stadium active state) + isolated glass-blue add button. Shrinks on scroll down / expands on scroll up via a capture-phase scroll listener driving a motion spring.
- Home (`MapPage`): card feed (CatchGrid, single column) with a fixed glass list/map toggle; wordmark scrolls away with the feed. The map pane stays mounted in list mode — hidden with `visibility` (never `display: none`; a 0×0 container makes Mapbox recalculate zoom) and `MapView active` handles resize/save-restore.
- Catch details open as glass bottom-sheet dialogs (`CatchDialog` on home; same pattern in Search/Profile) — base styles carry the glass recipe, mobile media query only reshapes the positioner.
- Profile: contained dither header card + segmented Recent Activity/Stats in normal page flow; Search: filters in one horizontally scrolling row.

## Mobile (`mobile/`)
- Expo 56 bare workflow, React Native 0.85.3, new arch
- **Does not yet consume `thumb_url`** — `mobile/components/CatchCard.js` renders `photoUrl()` (full-resolution `storage_path`) directly, and `mobile/lib/upload.js` has its own independent upload path with no thumbnail generation. The grid-thumbnail fix (2026-07-15) is web-only; mobile parity would need native-side resize tooling, not a port of `src/exif.js`'s canvas-based resize.
- Only some `mobile/lib` files are symlinks into `src/lib` (formatters, groupByTime, groupPhotos, imageUtils, validation) — the rest of `mobile/lib` and all of `mobile/store` are independent real files, not shared with `src/`
- Map screen (`mobile/app/(tabs)/map.js`) fetches photos, maps `catch_id → catchId` + ISO → ms, calls `groupPhotos()`, renders one marker/list item per group
- Environment gotchas (Fabric layout quirks, Skia canvas limits, Metro/Supabase resolution, prebuild caveats) live in `mobile/AGENTS.md` — read it before touching native config or full-screen canvases

## Standards
- **No browser automation unless asked**: Don't use Chrome DevTools MCP / browser tools to verify changes unless explicitly requested
- **Zustand selectors**: Select only what's needed (`usePhotoStore(s => s.photos)`) — no whole-store subscriptions
- **Marker lifecycle**: Call `rebuildMarkers` only when necessary; use `identify.js` for batch processing outside React
- **Design tokens**: Use CSS custom properties from `src/tokens.js` — no hardcoded hex values in `.module.css`
- **Desktop isolation**: Mobile web changes go behind `@media (max-width: 600px)` / `useIsMobile()` guards; verify desktop (1440px) is untouched before committing
- **Design system**: `/design` (`src/pages/DesignPage.jsx`) is the reference for desktop + mobile web components/styles — it must only render real components/CSS classes (imported), never hand-rolled copies, so it can't drift from production. Shared visual recipes live in one place and are composed, not hand-copied: glass surface → `composes: glassSurface from 'src/styles/shared.module.css'`; avatar-with-fallback → `<Avatar>` from `src/components/ui/`. When adding a new shared recipe, put it there and add it to `/design` in the same change.

## Supabase Constraints
- **`user_metadata` must stay small** — it is embedded in the JWT on every request. Never store blobs, base64 data URLs, or large arrays here. Scalars only (display_name, bio, gear lists). Violations bloat the JWT past nginx's header buffer limit on the Storage API, causing silent 400 rejections on photo uploads while REST calls continue to work.
- **`avatar_url` lives in the `profiles` table only** — never write it to `user_metadata` via `supabase.auth.updateUser`. `useAuthStore.setUser` preserves it in local state across token refreshes; App.jsx syncs it from the profiles table on login.
- **JWT size warning** — App.jsx logs a warning if `access_token.length > 4000`. If you see this, something large was written to `user_metadata`.

## Test Fixtures
- **Always test upload flows with an account that has a profile picture set** — a fresh account has no avatar and a tiny JWT; the upload bug described above only manifests with a real avatar. Test accounts should mirror realistic user state.
- **Affected code paths to cover**: onboarding avatar upload → storage URL returned → `save-profile` API → `profiles` table (not `user_metadata`); photo upload → Supabase Storage PUT → catches insert → photo row insert.
