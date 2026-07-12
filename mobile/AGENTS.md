# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v56.0.0/ before writing any code.

## Environment gotchas (learned the hard way — 2026-07)

- **Fabric zero-height first layout**: under rn-screens + Fabric (RN 0.85), a screen's
  flex-sized subtree can get a zero-height first layout that never corrects, and
  absolutely-positioned siblings paint **above** in-flow siblings regardless of JSX
  order or zIndex. Full-screen background surfaces (DitherMesh) must follow the
  login.js pattern: page gets explicit `useWindowDimensions()` width/height, the
  background is one absolute layer, and the content is wrapped in a second absolute
  layer with explicit dims, ordered after it.
- **On-screen Skia canvases don't work here**: `<Canvas>` (CAMetalLayer) fails to
  allocate drawables on the iOS 26 simulator on cold start, and when it does render
  it composites above all sibling views. `DitherMesh` therefore renders the dither
  shader **offscreen** (`Skia.Surface.MakeOffscreen` → image snapshot → `<Image>`),
  as a frozen frame. Don't convert it back to a live `<Canvas>` without testing on
  a physical device.
- **Simulator Metal degrades with app relaunches**: after many terminate/launch
  cycles, `CAMetalLayer nextDrawable` starts returning nil ("allocation failed")
  for everything. Reboot the simulator (`xcrun simctl shutdown/boot`) before
  trusting any rendering test.
- **supabase-js must resolve to its CJS build**: the ESM build contains a bare
  dynamic `import()` Hermes cannot compile (`expo export` fails). metro.config.js
  pins `@supabase/supabase-js` → `dist/index.cjs`; keep that resolver when touching
  metro config.
- **Never run `expo prebuild --clean` casually**: the committed `ios/` contains the
  Mapbox native setup. The `@rnmapbox/maps` config plugin is registered in
  app.config.js, but prebuilding needs `RNMAPBOX_MAPS_DOWNLOAD_TOKEN` (secret sk.*)
  in the shell env.
- **Supabase RPCs**: global catch visibility (search + other-profile grids) goes
  through `search_catches` / `get_user_catches` security-definer functions —
  `supabase/mobile-rpcs.sql` must be applied in the Supabase SQL editor.
