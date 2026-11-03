# Hook Spot

This is an in-progress fishing app that I'm tinkering with! Live at [hook-spot.com](https://hook-spot.com).

<img width="1528" height="1082" alt="Screenshot 2026-07-11 at 1 45 28 PM" src="https://github.com/user-attachments/assets/1eb7606b-c9c4-48f8-a97a-e4e42ce59982" />
<img width="1528" height="1082" alt="Screenshot 2026-07-11 at 1 45 36 PM" src="https://github.com/user-attachments/assets/3d1f2940-709c-4bf9-829f-9d93f42f4501" />
<img width="1528" height="1082" alt="Screenshot 2026-07-11 at 1 45 39 PM" src="https://github.com/user-attachments/assets/3b5c612f-1728-4d51-b16a-5fe149d7d94d" />


## What it does

- **Public browsing** — anyone can browse the home feed, angler profiles, and search without an account. Signed in, the home feed shows your catches plus anglers you follow.
- **Map view** — each catch appears as a pin at its GPS coordinates. Click a pin to see the photo, species, date/time, rod, and fly. Multiple photos from the same upload session are grouped into a single pin.
- **Catch cards** — scrollable grid of catch cards next to the map, sorted newest first. Click any card to jump to it on the map and open its details.
- **Mobile web** — at phone widths the app switches to an app-like layout: a floating bottom nav (home, profile, search, add), a card feed with a list/map toggle, and bottom-sheet catch details.
- **Stats** — a tab on each profile with charts derived from your catch history: catches per month, time of day, species breakdown, and species by month.
- **Upload flow** — click **+** or drag photos onto the window to open the upload dialog. Claude automatically identifies the fish species from the image. Edit the species, rod, and fly before saving.
- **Edit & delete** — click the pencil icon on any catch to edit species, rod, or fly, or delete the catch entirely.
- **User profiles** — sign in with a one-time code sent to your email, then pick a username and avatar. Follow other anglers and explore their catches.
- **iOS app** — native Swift / SwiftUI app (in progress, `ios/`) sharing the same Supabase backend and API.

## Setup

### Requirements

- [Node.js](https://nodejs.org) 22.x
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

Run `supabase/schema.sql` in the Supabase SQL editor to create the `profiles`, `follows`, `catches`, and `photos` tables with RLS policies, then apply `supabase/migrations/` in order.

### Run

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### Deploy

Production runs on [Vercel](https://vercel.com): the Vite build is served statically and the API routes run as functions from `api/`, pinned to the `pdx1` region next to the Supabase database (`vercel.json`). To self-host instead, `npm run build && npm run serve` runs `server.js`, which serves `dist/` and the same API routes.

## Data model

Each catch is stored as a row in the `catches` table (`species`, `rod`, `fly`, `lat`, `lng`, `time`). Each photo is a row in the `photos` table with a `catch_id` foreign key back to its catch. Photos are stored in Supabase Storage as a 2048px original plus a ~960px thumbnail that the catch grids load. `scripts/backfill-thumbnails.js` generates thumbnails for older photos.

## Tech Stack

- **Frontend**
  - [React](https://react.dev) 19 — UI framework
  - [Vite](https://vitejs.dev) 6 — build tool and dev server
  - [React Router](https://reactrouter.com) 7 — client-side routing
  - [Zustand](https://github.com/pmndrs/zustand) — state management
  - [Motion](https://motion.dev) — animation
  - [Radix UI](https://www.radix-ui.com) — accessible components (dialog, dropdown-menu, scroll-area, tooltip)
  - [CSS Modules](https://github.com/css-modules/css-modules) — component-scoped styling

- **iOS** (in progress)
  - Swift / SwiftUI, iOS 26+
  - [Mapbox Maps SDK for iOS](https://github.com/mapbox/mapbox-maps-ios), [supabase-swift](https://github.com/supabase/supabase-swift), [Nuke](https://github.com/kean/Nuke)

- **Maps & Charts**
  - [Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/) — map rendering (loaded on demand)
  - [ApexCharts](https://apexcharts.com) — stats charts

- **APIs & Services**
  - [Supabase](https://supabase.com) — authentication, database, and storage
  - [Vercel](https://vercel.com) — hosting and API functions
  - [Claude](https://anthropic.com) (via Anthropic SDK) — fish species identification from photos

- **Utilities**
  - [exifr](https://github.com/MikeKovarik/exifr) — EXIF/GPS extraction
  - [heic-convert](https://github.com/alexcorvi/heic-convert) & [heic2any](https://github.com/alexcorvi/heic2any) — HEIC conversion
  - [Lucide](https://lucide.dev) — icon library
