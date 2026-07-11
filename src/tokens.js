// JS mirror of CSS custom properties in style.css
// Source of truth for future React Native / Expo parity

export const tokens = {
  // Colors
  accent: '#2563eb',

  // Dark UI
  darkBg: '#1A1953',
  uiBg: '#202020',
  dockBg: 'rgba(20, 20, 22, 0.82)',
  darkSurface: '#2c2c2e',
  darkBorder: '#3a3a3c',
  darkText: '#f4f4f5',
  darkMuted: '#a1a1aa',

  // Glass surface recipe (CSS: --glass-*)
  glassBg: 'rgba(22, 22, 24, 0.68)',
  glassFilter: 'blur(28px) saturate(1.8) brightness(0.9)',
  glassTipBg: 'rgba(22, 22, 24, 0.78)',

  // Layout
  radius: 8,
  navClearance: 96, // px before safe-area; CSS: --nav-clearance

  // Typography
  fontSans: '"Roboto", sans-serif',
  fontCondensed: '"Roboto Condensed", sans-serif',
  fontMono: '"Roboto Mono", monospace',
  fontDisplay: '"Geist Pixel", monospace',
}
