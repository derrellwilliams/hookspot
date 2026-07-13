// Shared scroll signal for the floating MobileNav (RN equivalent of the web's
// capture-phase window scroll listener in src/components/MobileNav/MobileNav.jsx).
// Each screen attaches useNavScrollHandler() to its scroller; MobileNav
// animates from navT. 0 = full size, 1 = compact.
import { usePathname } from 'expo-router'
import { makeMutable, useAnimatedScrollHandler } from 'react-native-reanimated'
import { SPRINGS } from './theme'
import { spring } from './motion'

export const navT = makeMutable(0)

// The route MobileNav currently considers focused. Scroll events from a
// screen that's mid-momentum-scroll after the user has already switched
// tabs are stamped with the old pathname and must not touch navT, or the
// nav can get stuck compact on the newly focused screen.
const activePath = makeMutable(null)

const SCROLL_SLOP = 12
const TOP_ZONE = 24

export function useNavScrollHandler() {
  const pathname = usePathname()
  return useAnimatedScrollHandler({
    onScroll: (e, ctx) => {
      'worklet'
      if (activePath.value !== pathname) return
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
        navT.value = spring(target, SPRINGS.soft)
      }
    },
  })
}

// Fresh page starts at full size (web resets on route change)
export function resetNav(pathname) {
  activePath.value = pathname
  navT.value = spring(0, SPRINGS.soft)
}
