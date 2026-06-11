import { useEffect, useState } from 'react'

// env(safe-area-inset-*) is only readable from CSS, so measure it via a probe
// element. Values change on orientation flips, hence the resize listener.
function measure() {
  const probe = document.createElement('div')
  probe.style.cssText =
    'position:fixed;visibility:hidden;pointer-events:none;' +
    'padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);' +
    'padding-left:env(safe-area-inset-left);padding-right:env(safe-area-inset-right);'
  document.body.appendChild(probe)
  const style = getComputedStyle(probe)
  const insets = {
    top: parseFloat(style.paddingTop) || 0,
    bottom: parseFloat(style.paddingBottom) || 0,
    left: parseFloat(style.paddingLeft) || 0,
    right: parseFloat(style.paddingRight) || 0,
  }
  probe.remove()
  return insets
}

export function useSafeAreaInsets() {
  const [insets, setInsets] = useState(() => measure())

  useEffect(() => {
    const onResize = () => setInsets(prev => {
      const next = measure()
      return prev.top === next.top && prev.bottom === next.bottom &&
        prev.left === next.left && prev.right === next.right ? prev : next
    })
    window.addEventListener('resize', onResize)
    window.addEventListener('orientationchange', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onResize)
    }
  }, [])

  return insets
}
