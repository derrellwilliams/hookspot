# Hook Spot — Claude Guidelines

## Tech Stack
- **React 19** + Vite 6 (`@vitejs/plugin-react@4` — do NOT upgrade to v5/v6)
- **Zustand v5**: `src/store/usePhotoStore.js`, `src/store/useAuthStore.js`
- **React Router 7** (`BrowserRouter`); routes: `/` (MapPage), `/login`, `/onboarding`, `/user/:username`, `/profile` (redirect), `/search`, `/design`
- **Supabase** auth (emailed one-time code) + storage + database (`src/lib/supabase.js`)
- **Mapbox GL JS** (raw, no react-map-gl) — lazy-loaded, see Performance
- **Radix UI** for modals, dropdowns, tooltips; **lucide-react** icons via `src/components/icons.js` (iOS: SF Symbols)
- **CSS Modules** + CSS custom properties; tokens in `src/tokens.js` mirror `src/style.css`

## Key Files
- **Entry**: `src/main.jsx` → `src/App.jsx`
- **Pages**: `src/pages/` — MapPage, LoginPage, OnboardingPage, UserProfilePage, SearchPage, DesignPage, NotFoundPage, FeedPage (WIP, unrouted)
- **Components**: `src/components/` — Map (MapView, PopupCarousel), CatchGrid, CatchDialog, Nav (desktop), MobileNav (mobile web), UploadDialog, DropOverlay, FavoritePicker, FollowListDialog, Toast, UserRow, ui/; root-level `DitherMesh.jsx`, `PixelFishLoader.jsx`, `RequireAuth.jsx`, `ErrorBoundary.jsx`, `icons.js`
- **Stores**: `usePhotoStore` (photos, groups, flyToPhoto, activeGroup, hoveredPhotoName, toast, uploadOpen, pendingUploadFiles, photosInitialized); `useAuthStore` (user, session, username, loading)
- **Hooks**: `src/hooks/` — useIsMobile.js (`useIsMobile`, `useCanHover`, `useReducedMotion`, `MOBILE_QUERY`), useMapbox.js
- **Lib**: `src/lib/` — fileLoader.js, groupPhotos.js, groupByTime.js, formatters.js, supabase.js, geocode.js, weather.js, waterbody.js, validation.js, imageUtils.js, mapbox.js, avatarUpload.js, motion.js
- **Utilities**: `src/exif.js`, `src/identify.js`, `src/stats.js` — keep pure (no React)
- **API**: handler logic lives in root-level `*-handler.js` files, mounted three ways — Vercel functions in `api/*.js` (production), Vite middleware in `vite.config.js` (dev), and `server.js` (self-host, `npm run serve`). Routes: `/identify` (Claude via Anthropic SDK; model in `identify-config.js`), `/api/check-username`, `/api/save-profile`, `/api/profile`, `/api/photos`, `/api/search-users`, `/api/search-catches`. A new route needs all three.
- **Share-link previews**: `catch-meta-handler.js` injects OG tags into the SPA shell for `/user/:username?catch=<id>`. On Vercel a `has: query catch` rewrite sends those to `api/catch-meta.js`, which reads `dist/index.html` (bundled via `includeFiles` in `vercel.json`); dev and `server.js` intercept the same URL shape themselves.

## Data Model
- **`catches`** — one row per fishing session: `id, user_id, species, rod, fly, lat, lng, time`
- **`photos`** — one row per image: `catch_id (FK → catches)`, `filename, storage_path, url, thumb_url, species, lat, lng, time, meta`
- Every upload creates a `catches` row first, then inserts photos with that `catch_id`
- `thumb_url` is a best-effort ~960px grid thumbnail (`resizeForThumb()` in `src/exif.js`, uploaded by `uploadThumbnail()` in `src/lib/fileLoader.js`) generated alongside the full 2048px original on every upload. `mapPhotoRow()` sets `thumbUrl: thumb_url ?? url`, so photos without one fall back to the full image. `scripts/backfill-thumbnails.js` (`--force` regenerates) backfills older photos.
- **Thumbnail generation must stay sequential and best-effort** — it runs strictly after the main image upload succeeds, wrapped in try/catch, and `thumb_url` is only included in the insert when generation actually succeeded. A 2026-06 attempt ran both uploads in parallel and always sent `thumb_url` (even as `null`), which broke every upload in production — don't reintroduce either pattern.
- `groupPhotos(photos)` in `src/lib/groupPhotos.js` groups by `catchId`; photos with no `catchId` become singleton groups
- `PopupCarousel.saveEdit()` writes edits to both `photos` and `catches` to keep them in sync

## Architecture
- **Public read, auth-gated writes**: `/`, `/user/:username`, `/search` work signed out (home shows everyone's recent catches via `/api/photos` with no `userId`; signed in, it's you + people you follow). Every write entry point (add-catch buttons, drag-drop, follow, `/profile`, `/onboarding`) sends signed-out users to `/login`, which doubles as sign-up. `initPhotos()` clears the store when the feed owner changes (sign in/out) so `isOwn` flags never go stale.
- `MapPage` stays mounted (`display: none`) while other routes show, so the map isn't rebuilt on every visit home.
- `PopupCarousel` is the catch-detail view, rendered inside `CatchDialog` (home) and the Search/Profile dialogs; `showMap` adds a live mini-map.
- `DropOverlay` listens globally to drag events; on drop it sets `pendingUploadFiles` + opens `UploadDialog` — all uploads go through one flow

## Performance (home feed load path)
- `initPhotos()` builds photos straight from `/api/photos` rows via `mapPhotoRow()` — never download, decode, or canvas-process images client-side just to display them. `<img>` streams from the Storage CDN.
- `CatchCard` loads the first 6 images (2 on mobile, ~what's above the fold) with `loading="eager"` + `fetchPriority="high"`; the rest are lazy.
- **Never import `mapbox-gl` statically.** Use `useMapbox(enabled)` (returns `mapboxgl` or null; backed by `loadMapbox()` in `src/lib/mapbox.js`, which retries). `mapbox-gl.css` is imported statically in `main.jsx` *before* `style.css` so the app's overrides win. `heic2any` is likewise `import()`ed only when needed. Main bundle is ~420KB gz; keep heavy libs out of it.
- `MapView` initializes immediately when visible; when hidden (mobile list view) it waits for the feed's non-lazy images, and never initializes while its container is 0×0.
- `main.jsx` reloads once on `vite:preloadError` so a tab opened before a deploy recovers from missing lazy chunks.
- Vercel functions are pinned to `pdx1` (`vercel.json`) next to Supabase (us-west-2) — cross-region round-trips made `/api/photos` 1–2s. Keep handler Supabase calls parallel where possible.

## Mobile Web (≤600px)
- Breakpoint: `@media (max-width: 600px)` in CSS, `useIsMobile()`/`MOBILE_QUERY` in JS. Desktop >600px keeps the top glass `Nav` + split-pane layouts and must never be affected by mobile changes.
- `MobileNav` (`src/components/MobileNav/`): Instagram-style floating icon pill (Catches/Profile/Search, cell-wide stadium active state) + isolated glass-blue add button. Shrinks on scroll down / expands on scroll up via a capture-phase scroll listener driving a motion spring. (Replaced the old dock 2026-07-11; revert via `git revert -m 1 9bdfd6a`.)
- Home (`MapPage`): card feed (CatchGrid, single column) with a fixed glass list/map toggle; wordmark scrolls away with the feed. The map pane stays mounted in list mode — hidden with `visibility` (never `display: none`; a 0×0 container makes Mapbox recalculate zoom) and `MapView active` handles resize/save-restore.
- Catch details open as glass bottom-sheet dialogs (`CatchDialog` on home; same pattern in Search/Profile) — base styles carry the glass recipe, mobile media query only reshapes the positioner.
- Profile: contained dither header card + segmented Recent Activity/Stats in normal page flow; Search: filters in one horizontally scrolling row.

## iOS (`ios/`)
- Native Swift / SwiftUI app, iOS 26+, replacing the deleted Expo app (`mobile/`, removed 2026-10-30; recover from git history if needed). Plan: Mapbox Maps SDK for iOS, supabase-swift, Nuke; talks to the same `/api/*` routes and Supabase tables as the web.
- Must follow the same upload order and `thumb_url` rules as `src/lib/fileLoader.js` (see Data Model), and the same `user_metadata` / `avatar_url` constraints (see Supabase Constraints).
- `supabase/mobile-rpcs.sql` and its deployed RPCs stay — migration 006 references them.

## Standards
- **No browser automation unless asked**: Don't use Chrome DevTools MCP / browser tools to verify changes unless explicitly requested
- **No test suite**: CI (`.github/workflows/ci.yml`) runs `npm run build` + `npm audit --audit-level=high` on push/PR — make sure the build passes.
- **Zustand selectors**: Select only what's needed (`usePhotoStore(s => s.photos)`) — no whole-store subscriptions
- **Markers**: `MapView` diffs markers against `groups` in one effect (keeping existing markers/popups); don't rebuild them wholesale.
- **Design tokens**: Use CSS custom properties from `src/tokens.js` — no hardcoded hex values in `.module.css`
- **Desktop isolation**: Mobile web changes go behind `@media (max-width: 600px)` / `useIsMobile()` guards; verify desktop (1440px) is untouched before committing
- **Design system**: `/design` (`src/pages/DesignPage.jsx`) is the reference for desktop + mobile web components/styles — it must only render real components/CSS classes (imported), never hand-rolled copies, so it can't drift from production. Shared visual recipes live in one place and are composed, not hand-copied: glass surface → `composes: glassSurface from 'src/styles/shared.module.css'`; avatar-with-fallback → `<Avatar>` from `src/components/ui/`. When adding a new shared recipe, put it there and add it to `/design` in the same change.

## Supabase Constraints
- **`user_metadata` must stay small** — it is embedded in the JWT on every request. Never store blobs, base64 data URLs, or large arrays here. Scalars only (display_name, bio, gear lists). Violations bloat the JWT past nginx's header buffer limit on the Storage API, causing silent 400 rejections on photo uploads while REST calls continue to work. App.jsx clears any legacy `data:` avatar URL from `user_metadata` on sign-in.
- **`avatar_url` lives in the `profiles` table only** — never write it to `user_metadata` via `supabase.auth.updateUser`. `useAuthStore.setUser` preserves it in local state across token refreshes; App.jsx syncs it from the profiles table on login.
- **New public tables need explicit grants** — from 2026-10-30 Supabase no longer auto-grants Data API access to new `public` tables. A migration that creates one must `grant select` to `anon`, `grant select, insert, update, delete` to `authenticated` and `service_role`, and `grant select` to `backup_reader` (weekly backup job, `.github/workflows/db-backup.yml`), or those calls fail with "permission denied". Don't restore auto-grants via `alter default privileges`.
- **Keep-alive** — `.github/workflows/keep-alive.yml` queries `profiles` via REST twice a day so the free-tier project doesn't pause. GitHub disables scheduled workflows after 60 days without a commit; re-enable from the Actions tab.

## Test Fixtures
- **Always test upload flows with an account that has a profile picture set** — a fresh account has no avatar and a tiny JWT; the upload bug described above only manifests with a real avatar. Test accounts should mirror realistic user state.
- **Affected code paths to cover**: onboarding avatar upload → storage URL returned → `save-profile` API → `profiles` table (not `user_metadata`); photo upload → Supabase Storage PUT → catches insert → photo row insert.
