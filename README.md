# Hook Spot

This is an in progress fishing app I'm working on!  You can drop GPS-tagged photos onto a map, track species, gear, and catch stats over time. 

<img width="1582" height="975" alt="Screenshot 2026-06-08 at 8 04 24 PM" src="https://github.com/user-attachments/assets/037ccc0e-b09d-4afa-811c-46390fac72f9" />
<img width="1582" height="975" alt="Screenshot 2026-06-08 at 8 04 30 PM" src="https://github.com/user-attachments/assets/4fb905d5-417a-433b-8712-2dbb5021125f" />


## What it does

- **Map view** — each catch appears as a pin at its GPS coordinates. Click a pin to see the photo, species, date/time, rod, and fly. Multiple photos from the same upload session are grouped into a single pin.
- **Sidebar** — scrollable list of all catches, sorted newest first. Click any entry to jump to it on the map.
- **Stats view** — charts derived from your catch history: catches per month, time of day, species breakdown, and species by month.
- **Upload flow** — click **+** or drag photos onto the window to open the upload dialog. Claude automatically identifies the fish species from the image. Edit the species, rod, and fly before saving.
- **Edit & delete** — click the pencil icon on any popup to edit species, rod, or fly, or delete the catch entirely.
- **User profiles** — sign up with email, create a profile with a custom username and avatar. View your profile and explore other anglers' catches.
- **Mobile app** — iOS app (Expo bare workflow) with the same map and catch list, sharing the same Supabase backend.

## Setup

### Requirements

- [Node.js](https://nodejs.org) 18+
- A [Mapbox](https://mapbox.com) account (free tier is fine)
- An [Anthropic](https://anthropic.com) API key (for species identification)
- A [Supabase](https://supabase.com) project

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
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### Database

Run `supabase/schema.sql` in the Supabase SQL editor to create the `profiles`, `follows`, `catches`, and `photos` tables with RLS policies.

### Run

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## Adding catches

Photos must have GPS metadata embedded (most phones do this automatically). HEIC, JPEG, PNG, and WebP are supported.

Click **+** or drag photos onto the app window — both paths open the upload dialog. Fill in species, rod, and fly, then submit. Each submission creates one catch entry in the database that all uploaded photos attach to.

## Data model

Each catch is stored as a row in the `catches` table (`species`, `rod`, `fly`, `lat`, `lng`, `time`). Each photo is a row in the `photos` table with a `catch_id` foreign key back to its catch. Photos are stored in Supabase Storage and cached in the browser's IndexedDB for fast subsequent loads.

## Tech Stack

- **Frontend**
  - [React](https://react.dev) 19 — UI framework
  - [Vite](https://vitejs.dev) 5 — build tool and dev server
  - [React Router](https://reactrouter.com) 7 — client-side routing
  - [Zustand](https://github.com/pmndrs/zustand) — state management
  - [Radix UI](https://www.radix-ui.com) — accessible components (dialog, dropdown-menu, scroll-area, tooltip)
  - [CSS Modules](https://github.com/css-modules/css-modules) — component-scoped styling

- **Mobile**
  - [Expo](https://expo.dev) 54 (bare workflow) + React Native 0.81.5
  - [Mapbox Maps SDK for React Native](https://github.com/rnmapbox/maps)

- **Maps & Charts**
  - [Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/) — map rendering
  - [ApexCharts](https://apexcharts.com) — stats charts

- **APIs & Services**
  - [Supabase](https://supabase.com) — authentication, database, and storage
  - [Claude](https://anthropic.com) (via Anthropic SDK) — fish species identification from photos

- **Utilities**
  - [exifr](https://github.com/MikeKovarik/exifr) — EXIF/GPS extraction
  - [heic-convert](https://github.com/alexcorvi/heic-convert) & [heic2any](https://github.com/alexcorvi/heic2any) — HEIC conversion
  - [Iconoir](https://iconoir.com) — icon library
