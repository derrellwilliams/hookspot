import styles from './PixelFishLoader.module.css'

// Same pixel-grid fish as SearchPage's idle icon, split into its 12 individual
// squares (tail -> head) so each one can be animated in on its own.
const PIXELS = [
  'M22 15h-2V9h2v6Z',
  'M20 17h-2v-2h2v2Z',
  'M20 9h-2V7h2v2Z',
  'M17 12h-2v-2h2v2Z',
  'M18 19h-6v-2h6v2Z',
  'M18 7h-6V5h6v2Z',
  'M12 17h-2v-2h2v2Z',
  'M12 9h-2V7h2v2Z',
  'M10 15H8v-2h2v2Z',
  'M10 11H8V9h2v2Z',
  'M8 13H6v-2h2v2Z',
  'M4 9h2v2H4v2h2v2H4v2H2V7h2v2Z',
]

function Pixels({ reverse = false }) {
  const last = PIXELS.length - 1
  return PIXELS.map((d, i) => (
    <path key={i} d={d} className={styles.pixel} style={{ '--i': reverse ? last - i : i }} />
  ))
}

// Continuous ambient chase through the fish (head -> tail, like it's
// swimming forward), dim silhouette always visible (good for a persistent
// loading state, no restart pop).
export function PixelFishLoader({ size = 64, className }) {
  return (
    <svg
      className={[styles.svg, styles.wave, className].filter(Boolean).join(' ')}
      width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"
    >
      <Pixels reverse />
    </svg>
  )
}
