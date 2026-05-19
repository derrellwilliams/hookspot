# Hook Spot — Claude Guidelines

## Tech Stack
- **React 19** + Vite 5 (`@vitejs/plugin-react@4` — do NOT upgrade to v5/v6)
- **Zustand v5**: `src/store/usePhotoStore.js`, `src/store/useAuthStore.js`
- **React Router 7** (`BrowserRouter`); routes: `/` (MapPage), `/login`, `/onboarding`, `/user/:username`, `/profile` (redirect), `/design`
- **Supabase** auth + profiles (`src/lib/supabase.js`)
- **Mapbox GL JS** (raw, no react-map-gl); popups use `createRoot(el).render(<PopupCarousel/>)`
- **Radix UI** for modals, dropdowns, tooltips; **iconoir-react** icons
- **CSS Modules** + CSS custom properties; tokens in `src/tokens.js` mirror `src/style.css`

## Key Files
- **Entry**: `src/main.jsx` → `src/App.jsx`
- **Pages**: `src/pages/` — MapPage, StatsPage, LoginPage, OnboardingPage, UserProfilePage, DesignPage, NotFoundPage, FeedPage (WIP, unrouted)
- **Components**: `src/components/` — Map, Sidebar, Nav, UploadDialog, DropOverlay, FavoritePicker, Toast, ui/; root-level `ProfileBlob.jsx`, `RequireAuth.jsx`
- **Stores**: `usePhotoStore` (photos, groups, flyToPhoto, activeGroup, toast, uploadOpen, bulkUploading, pendingUploadFiles, ownOnly, photosInitialized); `useAuthStore` (user, session, username, loading)
- **Lib**: `src/lib/` — fileLoader.js, groupByTime.js, formatters.js, supabase.js, geocode.js, weather.js, validation.js, imageUtils.js, mesh.js
- **Utilities**: `src/cache.js` (IndexedDB), `src/exif.js`, `src/identify.js`, `src/stats.js` — keep pure (no React)
- **API**: Vite middleware in `vite.config.js` — `/identify` (Claude AI via Anthropic SDK, requires `ANTHROPIC_API_KEY`), `/api/check-username`, `/api/save-profile`, `/api/profile`, `/api/photos`

## Architecture
- `PopupCarousel` runs in its own React root inside Mapbox popup DOM; unmount on popup close to prevent leaks
- `DropOverlay` listens globally to drag events; calls `handleFiles()` from fileLoader.js on drop
- `src/cache.js` — IndexedDB `fishmap-cache` caches photo blobs + EXIF keyed by `{userId}/{filename}`; fileLoader checks cache before network

## Standards
- **Zustand selectors**: Select only what's needed (`usePhotoStore(s => s.photos)`) — no whole-store subscriptions
- **Marker lifecycle**: Call `rebuildMarkers` only when necessary; use `identify.js` for batch processing outside React
- **Design tokens**: Use CSS custom properties from `src/tokens.js` — no hardcoded hex values in `.module.css`
