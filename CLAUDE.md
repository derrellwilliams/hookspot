# Hook Spot — Claude Guidelines

## Think Before Coding
Read relevant files and understand the existing architecture before proposing changes. If a task is ambiguous, ask for clarification rather than guessing.

## Simplicity First
Prefer the simplest solution that meets the requirement. Avoid adding layers, abstractions, or configurations that aren't immediately needed.

## Surgical Changes
Change only what is necessary. Do not refactor surrounding code, add docstrings, or clean up unrelated things unless explicitly asked.

## Goal-Driven Execution
Stay focused on what was asked. If you discover related improvements, mention them after completing the task — don't silently expand scope.

## Project-Specific Notes
- CSS Modules + CSS custom properties (no Tailwind)
- State management via Zustand (`src/store/usePhotoStore.js`)
- Routing via React Router (`BrowserRouter`, `/` → MapPage, `/stats` → StatsPage)
- Map: raw mapbox-gl (no react-map-gl); popups use `createRoot(el).render(<PopupCarousel/>)`
- Keep `src/cache.js`, `src/exif.js`, `src/identify.js` as pure utilities — no React needed
- Design tokens are in `src/tokens.js` (JS mirror of CSS custom properties in `src/style.css`)
