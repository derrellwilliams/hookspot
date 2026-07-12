// Shared scroll signal for the floating MobileNav (RN equivalent of the web's
// capture-phase window scroll listener in src/components/MobileNav/MobileNav.jsx).
// Each screen attaches useNavScrollHandler() to its scroller; MobileNav
// animates from navT. 0 = full size, 1 = compact.
import { makeMutable, useAnimatedScrollHandler, withSpring } from 'react-native-reanimated'
import { SPRINGS } from './theme'

export const navT = makeMutable(0)

const SCROLL_SLOP = 12
const TOP_ZONE = 24

export function useNavScrollHandler() {
  return useAnimatedScrollHandler({
    onScroll: (e, ctx) => {
      'worklet'
      const y = e.contentOffset.y
      const last = ctx.lastY ?? y
      ctx.lastY = y
      const delta = y - last
      let target = null
      if (y <= TOP_ZONE) target = 0
      else if (delta > SCROLL_SLOP) target = 1
      else if (delta < -SCROLL_SLOP) target = 0
      if (target !== null && ctx.target !== target) {
        ctx.target = target
        navT.value = withSpring(target, SPRINGS.soft)
      }
    },
  })
}

// Fresh page starts at full size (web resets on route change)
export function resetNav() {
  navT.value = withSpring(0, SPRINGS.soft)
}
