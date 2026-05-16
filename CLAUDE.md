# Hook Spot — Claude Guidelines

## Working Style
- Read relevant files before making changes. If a task is ambiguous, ask rather than guess.
- Change only what's necessary. Don't refactor, add docstrings, or clean up adjacent code.
- Prefer the simplest solution. No extra abstractions, configs, or features beyond what's asked.
- Stay focused. Mention related improvements after the task — don't silently expand scope.

## Tech Stack
- **React 19** + Vite 5 (`@vitejs/plugin-react@4` — required; do NOT upgrade to v5/v6)
- **Zustand v5** state: `src/store/usePhotoStore.js`, `src/store/useAuthStore.js`
- **React Router 7** (`BrowserRouter`); routes: `/` (MapPage), `/login`, `/onboarding`, `/user/:username`, `/profile` (redirect), `/design`
- **Supabase** for auth and user profiles (`src/lib/supabase.js`)
- **Mapbox GL JS** (raw, no react-map-gl); popups render with `createRoot(el).render(<PopupCarousel/>)`
- **Radix UI**: `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-scroll-area`, `@radix-ui/react-tooltip`
- **iconoir-react** icons; `<IconoirProvider strokeWidth={2}>` wraps the app in `App.jsx`
- **apexcharts** for stats charts rendered by `src/stats.js`
- **CSS Modules** + CSS custom properties; design tokens in `src/tokens.js` mirror `src/style.css`

## Key Files
- **Entry**: `src/main.jsx` → `src/App.jsx`
- **Pages**: `src/pages/` — MapPage, StatsPage, LoginPage, OnboardingPage, UserProfilePage, DesignPage, NotFoundPage, FeedPage (WIP, unrouted)
- **Components**: `src/components/` — Map, Sidebar, Nav, UploadDialog, DropOverlay, FavoritePicker, Toast, ui/; plus root-level `ProfileBlob.jsx`, `RequireAuth.jsx`
- **Stores**: `src/store/usePhotoStore.js` (photos, groups, flyToPhoto, activeGroup, toast, uploadOpen, bulkUploading, pendingUploadFiles, ownOnly, photosInitialized); `src/store/useAuthStore.js` (user, session, username, loading)
- **Lib**: `src/lib/` — fileLoader.js, groupByTime.js, formatters.js, supabase.js, geocode.js, weather.js, validation.js, imageUtils.js, mesh.js
- **Utilities**: `src/cache.js` (IndexedDB photo cache), `src/exif.js`, `src/identify.js`, `src/stats.js` — keep pure (no React)
- **Styles**: `src/style.css` (global tokens + Mapbox overrides); component `.module.css` files
- **API**: Vite middleware in `vite.config.js` — `/identify` (Claude AI species ID via Anthropic SDK), `/api/check-username`, `/api/save-profile`, `/api/profile`, `/api/photos`

## Architecture
- `PopupCarousel` renders in its own React root (Mapbox popup DOM element); subscribes to Zustand for live updates; unmount the root when the popup closes to prevent memory leaks
- `MapView` sets `flyToPhoto` in store after `rebuildMarkers`; `Sidebar` calls it for map fly-to animation
- `SidebarItem` reads `activeGroup` from store; uses `useRef` + `scrollIntoView` for auto-scroll
- `RequireAuth` guards all routes except `/login` and `/onboarding`
- Supabase session managed in `App.jsx` `useEffect`; no profile → redirects to `/onboarding`
- `DropOverlay` listens globally to drag events; calls `handleFiles()` from fileLoader.js on drop
- `FavoritePicker` filters to the current user's own photos; used on profile pages
- `ProfileBlob` renders an animated mesh gradient via `animateMesh()` from `src/lib/mesh.js`
- `src/cache.js` — IndexedDB db `fishmap-cache` caches photo blobs + EXIF; keyed by `{userId}/{filename}`; fileLoader checks cache before fetching from server
- `/identify` calls Claude AI (requires `ANTHROPIC_API_KEY`); add to `.env` docs if adding new external service deps

## Standards
- **Zustand selectors**: Always select only what's needed (`usePhotoStore(s => s.photos)`) to prevent unnecessary re-renders
- **Marker lifecycle**: Call `rebuildMarkers` only when necessary; use `identify.js` for batch processing outside the React render cycle
- **Design tokens**: Use CSS custom properties from `src/tokens.js` — no hardcoded hex values in `.module.css`
- **Radix UI**: Use Radix primitives for modals, dropdowns, and tooltips to maintain accessibility
