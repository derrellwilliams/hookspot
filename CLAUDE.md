# Hook Spot — Claude Guidelines

## Tech Stack
- **React 19** + Vite 5 (`@vitejs/plugin-react@4` — do NOT upgrade to v5/v6)
- **Zustand v5**: `src/store/usePhotoStore.js`, `src/store/useAuthStore.js`
- **React Router 7** (`BrowserRouter`); routes: `/` (MapPage), `/login`, `/onboarding`, `/user/:username`, `/profile` (redirect), `/design`
- **Supabase** auth + storage + database (`src/lib/supabase.js`)
- **Mapbox GL JS** (raw, no react-map-gl); popups use `createRoot(el).render(<PopupCarousel/>)`
- **Radix UI** for modals, dropdowns, tooltips; **iconoir-react** icons
- **CSS Modules** + CSS custom properties; tokens in `src/tokens.js` mirror `src/style.css`

## Key Files
- **Entry**: `src/main.jsx` → `src/App.jsx`
- **Pages**: `src/pages/` — MapPage, LoginPage, OnboardingPage, UserProfilePage, DesignPage, NotFoundPage, FeedPage (WIP, unrouted)
- **Components**: `src/components/` — Map, Sidebar, Nav, UploadDialog, DropOverlay, FavoritePicker, Toast, ui/; root-level `ProfileBlob.jsx`, `RequireAuth.jsx`
- **Stores**: `usePhotoStore` (photos, groups, flyToPhoto, activeGroup, toast, uploadOpen, bulkUploading, pendingUploadFiles, ownOnly, photosInitialized); `useAuthStore` (user, session, username, loading)
- **Lib**: `src/lib/` — fileLoader.js, groupPhotos.js, formatters.js, supabase.js, geocode.js, weather.js, validation.js, imageUtils.js, mesh.js
- **Utilities**: `src/cache.js` (IndexedDB), `src/exif.js`, `src/identify.js`, `src/stats.js` — keep pure (no React)
- **API**: Vite middleware in `vite.config.js` — `/identify` (Claude AI via Anthropic SDK, requires `ANTHROPIC_API_KEY`), `/api/check-username`, `/api/save-profile`, `/api/profile`, `/api/photos`

## Data Model
- **`catches`** — one row per fishing session: `id, user_id, species, rod, fly, lat, lng, time`
- **`photos`** — one row per image: `catch_id (FK → catches)`, `filename, storage_path, url, species, lat, lng, time, meta`
- Every upload creates a `catches` row first, then inserts photos with that `catch_id`
- `groupPhotos(photos)` in `src/lib/groupPhotos.js` groups by `catchId`; photos with no `catchId` become singleton groups
- `PopupCarousel.saveEdit()` writes edits to both `photos` and `catches` to keep them in sync

## Architecture
- `PopupCarousel` runs in its own React root inside Mapbox popup DOM; unmount on popup close to prevent leaks
- `DropOverlay` listens globally to drag events; on drop it sets `pendingUploadFiles` + opens `UploadDialog` — all uploads go through one flow
- `src/cache.js` — IndexedDB `fishmap-cache` caches photo blobs + EXIF keyed by `{userId}/{filename}`; fileLoader checks cache before network

## Mobile (`mobile/`)
- Expo 54 bare workflow, React Native 0.81.5
- `mobile/store` and `mobile/lib` are symlinks → `../src/store` and `../src/lib` (shared code)
- Map screen (`mobile/app/(tabs)/map.js`) fetches photos, maps `catch_id → catchId` + ISO → ms, calls `groupPhotos()`, renders one marker/list item per group

## Standards
- **Zustand selectors**: Select only what's needed (`usePhotoStore(s => s.photos)`) — no whole-store subscriptions
- **Marker lifecycle**: Call `rebuildMarkers` only when necessary; use `identify.js` for batch processing outside React
- **Design tokens**: Use CSS custom properties from `src/tokens.js` — no hardcoded hex values in `.module.css`

## Supabase Constraints
- **`user_metadata` must stay small** — it is embedded in the JWT on every request. Never store blobs, base64 data URLs, or large arrays here. Scalars only (display_name, bio, gear lists). Violations bloat the JWT past nginx's header buffer limit on the Storage API, causing silent 400 rejections on photo uploads while REST calls continue to work.
- **`avatar_url` lives in the `profiles` table only** — never write it to `user_metadata` via `supabase.auth.updateUser`. `useAuthStore.setUser` preserves it in local state across token refreshes; App.jsx syncs it from the profiles table on login.
- **JWT size warning** — App.jsx logs a warning if `access_token.length > 4000`. If you see this, something large was written to `user_metadata`.

## Test Fixtures
- **Always test upload flows with an account that has a profile picture set** — a fresh account has no avatar and a tiny JWT; the upload bug described above only manifests with a real avatar. Test accounts should mirror realistic user state.
- **Affected code paths to cover**: onboarding avatar upload → storage URL returned → `save-profile` API → `profiles` table (not `user_metadata`); photo upload → Supabase Storage PUT → catches insert → photo row insert.
