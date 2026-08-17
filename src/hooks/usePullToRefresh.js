import { useEffect, useRef, useState } from 'react'

const THRESHOLD = 70

export function usePullToRefresh(onRefresh) {
  const [pulling, setPulling] = useState(false)
  const startY = useRef(null)
  const armed = useRef(false)
  const onRefreshRef = useRef(onRefresh)
  onRefreshRef.current = onRefresh

  useEffect(() => {
    function handleTouchStart(e) {
      startY.current = window.scrollY <= 0 && e.touches.length === 1 ? e.touches[0].clientY : null
    }

    function handleTouchMove(e) {
      if (startY.current == null || e.touches.length === 0) return
      const delta = e.touches[0].clientY - startY.current
      if (delta > THRESHOLD && !armed.current) {
        armed.current = true
        setPulling(true)
      }
    }

    function handleTouchEnd() {
      startY.current = null
      if (!armed.current) return
      armed.current = false
      setPulling(false)
      Promise.resolve(onRefreshRef.current()).catch((err) => console.error(err))
    }

    // Listeners live for the component's whole lifetime (no `pulling` in the
    // deps) so they never get torn down and rebuilt mid-gesture.
    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    window.addEventListener('touchend', handleTouchEnd, { passive: true })
    window.addEventListener('touchcancel', handleTouchEnd, { passive: true })
    return () => {
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
      window.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [])

  return pulling
}
