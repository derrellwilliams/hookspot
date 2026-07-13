import { Dithering } from '@paper-design/shaders-react'
import { useReducedMotion } from '../hooks/useIsMobile.js'

// Animated dithered-gradient background used everywhere the old radial-gradient
// mesh was (login/onboarding/404 backgrounds, profile header). Single source of
// truth: tweak the params here and every surface updates. Fills whatever
// positioned box its className gives it.
export function DitherMesh({ className, ...props }) {
  const reducedMotion = useReducedMotion()
  return (
    <Dithering
      className={className}
      colorBack="#1a1952"
      colorFront="#2e2e76"
      shape="warp"
      type="4x4"
      size={2.5}
      speed={reducedMotion ? 0 : 0.08}
      scale={0.6}
      {...props}
    />
  )
}
