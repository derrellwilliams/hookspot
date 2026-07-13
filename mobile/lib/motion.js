// Reduced-motion-aware replacement for withSpring: falls back to a short,
// non-bouncy withTiming so indicators still move (comprehension) without
// overshoot or lingering physics (Apple's "reduced motion" guidance).
import { withSpring, withTiming } from 'react-native-reanimated'
import { reducedMotion } from './reducedMotion'

export function spring(target, config) {
  'worklet'
  return reducedMotion.value ? withTiming(target, { duration: 150 }) : withSpring(target, config)
}
