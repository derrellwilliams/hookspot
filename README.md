# Hook Spot

A personal fishing log — drop GPS-tagged photos onto a map, track species, gear, and catch stats over time.

<img width="1294" height="971" alt="Screenshot 2026-04-24 at 1 00 23 PM" src="https://github.com/user-attachments/assets/637f2354-e18a-4ac6-b33f-4ecc60a2cf4a" />
<img width="1294" height="971" alt="Screenshot 2026-04-24 at 1 00 15 PM" src="https://github.com/user-attachments/assets/0a2df8d8-0ba2-47b4-975c-90bb6b562310" />

## What it does

- **Map view** — each catch appears as a pin at the GPS coordinates from your photo. Click a pin to see the photo, species, date/time, rod, and fly. Photos taken within 3 minutes of each other at the same location are grouped into a single pin.
- **Sidebar** — scrollable list of all catches, sorted newest first. Click any entry to jump to it on the map.
- **Stats view** — charts derived from your catch history: catches per month, time of day, species breakdown, and species by month.
- **Upload flow** — click the **+** button or "Add a catch" in the sidebar to open the upload dialog. Pick or drop a photo, and Claude will automatically identify the fish species from the image. You can edit the species, rod, and fly before saving.
- **Edit & delete** — click the pencil icon on any popup to edit species, rod, or fly, or delete the catch entirely.

## Setup

### Requirements

- [Node.js](https://nodejs.org) 18+
- A [Mapbox](https://mapbox.com) account (free tier is fine)
- An [Anthropic](https://anthropic.com) API key (for species identification)

### Install

```bash
npm install
```

### Environment

Create a `.env` file in the project root:

```
VITE_MAPBOX_TOKEN=your_mapbox_token_here
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

1. **Upload dialog** — click **+** or "Add a catch", pick your photo, let the AI identify the species (or type it yourself), fill in rod and fly, then submit.
2. **Drag and drop** — drag image files directly onto the app window.

You can also drop photos into the `images/` folder directly — they'll be picked up automatically on the next dev server start.

## Data storage

- Photos and metadata are cached in the browser's IndexedDB — no server or database required.
- Uploaded photos are saved to the `images/` folder on disk via the Vite dev server.
- Edits (species, rod, fly) are persisted in IndexedDB and survive page refreshes.

## Tech

- [Vite](https://vitejs.dev) — build tool and dev server
- [Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/) — map rendering
- [ApexCharts](https://apexcharts.com) — stats charts
- [exifr](https://github.com/MikeKovarik/exifr) — EXIF/GPS extraction
- [heic2any](https://github.com/alexcorvi/heic2any) — HEIC conversion in the browser
- Claude (via Anthropic API) — fish species identification from photos
