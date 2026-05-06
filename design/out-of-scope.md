# Out of Scope

This design system documents components and styles used on **login, onboarding, profile (catches), and profile pages** only.

## Not Documented Here

### App Pages
- **Map Page** (`/`) — Map view with markers, popups, sidebar
- **Stats Page** (`/stats`) — Statistics dashboard
- **Feed Page** (`/feed`) — Coming soon (minimal styles)

### Components Used Elsewhere
- **MapView** — Raw Mapbox GL integration
- **PopupCarousel** — Custom popup rendering in Mapbox
- **Sidebar** — Photo list navigation
- **SidebarItem** — Individual photo item
- **Nav** — Navigation bar
- **DropOverlay** — Drag-drop zone overlay

### Utilities & Stores
- **useAuthStore** — Auth state management (Zustand)
- **usePhotoStore** — Photo/group state management (Zustand)
- **Mesh animation** — Used only on login & onboarding

### UI Components Incomplete
- **AutocompleteInput**, **Select**, **SelectWithCustom** — Used elsewhere, not on these pages
- **Tooltip** — Used elsewhere, not on these pages

---

## Why Limit Scope?

1. **Clarity** — Only documents actual usage, avoiding hypothetical components
2. **Maintenance** — Design system stays aligned with implemented pages
3. **Discoverability** — Clear boundary between "auth/profile" and "map/feed" design languages
4. **Evolution** — Can expand scope as new pages are built

---

## To Expand

Add documentation for:
- Map/marker styles and interactions
- Stats charts and data visualization
- Sidebar and photo list UI
- Navigation and header patterns
- Upload flow and dialogs
