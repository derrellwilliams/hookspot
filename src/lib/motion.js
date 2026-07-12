// Shared motion tokens — single source of truth for spring configs and
// easing curves used with motion/react. Keep this file pure (no React).

export const SPRING = { type: 'spring', stiffness: 300, damping: 24 }       // default interactive spring (hover/tap)
export const SPRING_TIGHT = { type: 'spring', stiffness: 400, damping: 35 } // layoutId indicators (nav highlight, tabs)
export const SPRING_POP = { type: 'spring', stiffness: 400, damping: 25 }   // slight overshoot — dropdowns, chips

export const EASE_OUT = [0.23, 1, 0.32, 1]      // strong ease-out — UI entrances/exits
export const EASE_ENTER = [0.17, 0.67, 0.51, 1] // existing dialog entrance curve (kept as-is)
export const EASE_DRAWER = [0.32, 0.72, 0, 1]   // iOS-like drawer curve — mobile bottom sheets
