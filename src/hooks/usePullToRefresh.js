import { useEffect, useRef, useState } from 'react'

const THRESHOLD = 70

export function usePullToRefresh(onRefresh) {
  const [pulling, setPulling] = useState(false)
  const startY = useRef(null)

  useEffect(() => {
    function handleTouchStart(e) {
      if (window.scrollY <= 0) {
        startY.current = e.touches[0].clientY
      }
    }

    function handleTouchMove(e) {
      if (startY.current == null) return
      const delta = e.touches[0].clientY - startY.current
      if (delta > THRESHOLD) {
        setPulling(true)
      }
    }

    async function handleTouchEnd() {
      if (pulling) {
        await onRefresh()
      }
      setPulling(false)
      startY.current = null
    }

    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    window.addEventListener('touchend', handleTouchEnd)
    return () => {
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [pulling, onRefresh])

  return pulling
}
