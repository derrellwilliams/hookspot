// Mirror of src/tokens.js + the glass/spring/type values from src/style.css.
// Keep in sync with the web — mobile web (≤600px) is the design reference.

export const C = {
  bg: '#202020', // web --ui-bg
  surface: '#2c2c2e', // web --dark-surface
  border: '#3a3a3c', // web --dark-border
  text: '#f4f4f5', // web --dark-text
  muted: '#a1a1aa', // web --dark-muted
  cardMuted: '#8d8d8d', // CatchCard meta text (web CatchGrid.module.css)
  accent: '#2563eb',
  iosBlue: '#0a84ff',
  darkBg: '#1A1953', // dither mesh base
  htmlBg: '#111113', // web html/body bg; stats chart cards
  danger: '#ef4444',
}

// Glass surface recipe. Web: backdrop-filter blur + translucent fill.
// RN: BlurView underneath + these fills/hairlines layered on top.
export const GLASS = {
  // Sheets/dialogs/popups — web --glass-bg + blur(28px) saturate(1.8)
  sheetBg: 'rgba(22, 22, 24, 0.68)',
  sheetBlur: 90, // BlurView intensity ≈ blur(28px)
  // Nav pill / toggles — lighter variant, rgba(22,22,24,0.86) + blur(20px)
  navBg: 'rgba(22, 22, 24, 0.86)',
  navBlur: 70,
  tipBg: 'rgba(22, 22, 24, 0.78)', // opaque stand-in where blur can't apply
  hairline: 'rgba(255, 255, 255, 0.18)', // inset top highlight
  borderSoft: 'rgba(255, 255, 255, 0.08)', // 0.5px pill borders
  stadium: 'rgba(120, 120, 128, 0.36)', // active tab capsule
  thumb: 'rgba(120, 120, 128, 0.4)', // list/map toggle thumb
}

export const RADII = {
  base: 8,
  card: 16,
  sheet: 20,
  pill: 999,
}

// Framer Motion spring configs from the web, 1:1 usable with withSpring.
export const SPRINGS = {
  nav: { stiffness: 500, damping: 38 }, // nav stadium, view-toggle thumb
  segment: { stiffness: 400, damping: 35 }, // profile/follow tab underline
  soft: { stiffness: 320, damping: 34 }, // nav shrink/expand
}

export const FONTS = {
  sans: 'Roboto_400Regular',
  sansMedium: 'Roboto_500Medium',
  sansSemiBold: 'Roboto_600SemiBold', // web font-weight 600 (species, titles)
  sansBold: 'Roboto_700Bold',
  condensed: 'RobotoCondensed_400Regular',
  condensedSemiBold: 'RobotoCondensed_600SemiBold',
  mono: 'RobotoMono_400Regular',
  monoMedium: 'RobotoMono_500Medium',
  display: 'GeistPixel',
}

// Bottom clearance for the floating nav (web --nav-clearance, before safe area)
export const NAV_CLEARANCE = 96
