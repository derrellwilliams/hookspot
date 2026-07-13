import { useSyncExternalStore } from 'react'

// Keep in sync with the @media (max-width: 600px) breakpoint used across module CSS.
export const MOBILE_QUERY = '(max-width: 600px)'
const HOVER_QUERY = '(hover: hover)'
const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

function useMediaQuery(query) {
  return useSyncExternalStore(
    onChange => {
      const mql = window.matchMedia(query)
      mql.addEventListener('change', onChange)
      return () => mql.removeEventListener('change', onChange)
    },
    () => window.matchMedia(query).matches,
  )
}

export function useIsMobile() {
  return useMediaQuery(MOBILE_QUERY)
}

export function useCanHover() {
  return useMediaQuery(HOVER_QUERY)
}

export function useReducedMotion() {
  return useMediaQuery(REDUCED_MOTION_QUERY)
}
