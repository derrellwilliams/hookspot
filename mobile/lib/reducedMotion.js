// Shared reduced-motion flag, readable from worklets (UI thread) and JS thread
// alike. Set once from RootLayout via Reanimated's useReducedMotion(), which
// itself only reflects the setting at app start (no live rerender) — reading
// .value directly outside a hook is consistent with that same semantic.
import { makeMutable } from 'react-native-reanimated'

export const reducedMotion = makeMutable(false)
