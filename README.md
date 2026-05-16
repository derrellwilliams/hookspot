# Hook Spot

A social fishing log — drop GPS-tagged photos onto a map, track species, gear, and catch stats over time. View your catches on a map, explore other anglers' catches, and share your fishing adventures.

<img width="2757" height="1816" alt="hookspot" src="https://github.com/user-attachments/assets/5fe4ac85-da72-4042-8577-490097cb8195" />

## What it does

- **Map view** — each catch appears as a pin at the GPS coordinates from your photo. Click a pin to see the photo, species, date/time, rod, and fly. Photos taken within 3 minutes of each other at the same location are grouped into a single pin.
- **Sidebar** — scrollable list of all catches, sorted newest first. Click any entry to jump to it on the map.
- **Stats view** — charts derived from your catch history: catches per month, time of day, species breakdown, and species by month.
- **Upload flow** — click the **+** button to open the upload dialog. Pick or drop a photo, and Claude will automatically identify the fish species from the image. You can edit the species, rod, and fly before saving.
- **Edit & delete** — click the pencil icon on any popup to edit species, rod, or fly, or delete the catch entirely.
- **User profiles** — sign up with email, create a profile with a custom username and avatar. View your profile and explore other anglers' catches.
- **Authentication** — secure login via Supabase, with session persistence across page refreshes.

## Setup

### Requirements

- [Node.js](https://nodejs.org) 18+
- A [Mapbox](https://mapbox.com) account (free tier is fine)
- An [Anthropic](https://anthropic.com) API key (for species identification)
- A [Supabase](https://supabase.com) project (for authentication and user profiles)

### Install

```bash
npm install
```

### Environment

Create a `.env` file in the project root:

```
VITE_MAPBOX_TOKEN=your_mapbox_token_here
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

### Run

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Adding photos

Photos must have GPS metadata embedded (most phones do this automatically). HEIC, JPEG, PNG, and WebP are supported.

**Two ways to add catches:**

1. **Upload dialog** — click **+**, pick your photo, let Claude identify the species (or type it yourself), fill in rod and fly, then submit.
2. **Drag and drop** — drag image files directly onto the app window.

You can also drop photos into the `images/` folder directly — they'll be picked up automatically on the next dev server start.

## Data storage

- Photos and metadata are cached in the browser's IndexedDB for quick access.
- Uploaded photos are saved to the `images/` folder on disk via the Vite dev server.
- User profiles and authentication are managed by Supabase.
- Edits (species, rod, fly) are persisted in IndexedDB and survive page refreshes.

## Tech Stack

- **Frontend**
  - [React](https://react.dev) 19 — UI framework
  - [Vite](https://vitejs.dev) 5 — build tool and dev server
  - [React Router](https://reactrouter.com) 7 — client-side routing
  - [Zustand](https://github.com/pmndrs/zustand) — state management
  - [Radix UI](https://www.radix-ui.com) — accessible components (dialog, dropdown-menu, scroll-area, tooltip)
  - [CSS Modules](https://github.com/css-modules/css-modules) — component-scoped styling

- **Maps & Graphics**
  - [Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/) — map rendering
  - [ApexCharts](https://apexcharts.com) — stats charts

- **APIs & Services**
  - [Supabase](https://supabase.com) — authentication and database
  - [Claude](https://anthropic.com) (via Anthropic SDK) — fish species identification from photos

- **Utilities**
  - [exifr](https://github.com/MikeKovarik/exifr) — EXIF/GPS extraction
  - [heic-convert](https://github.com/alexcorvi/heic-convert) & [heic2any](https://github.com/alexcorvi/heic2any) — HEIC conversion
  - [Iconoir](https://iconoir.com) — icon library
