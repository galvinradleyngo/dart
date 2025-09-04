import { useCallback, useMemo, useState } from 'react';

/**
 * Detects horizontal swipe gestures and invokes callbacks
 * for left and right swipes on coarse pointer devices (touch).
 */
export function useSwipe(onLeft, onRight, threshold = 50) {
  const [startX, setStartX] = useState(null);
  const isMobile = useMemo(() =>
    typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches,
  []);
  const onTouchStart = useCallback((e) => setStartX(e.touches[0].clientX), []);
  const onTouchEnd = useCallback(
    (e) => {
      if (startX === null) return;
      const dx = e.changedTouches[0].clientX - startX;
      if (dx > threshold) onRight?.();
      else if (dx < -threshold) onLeft?.();
      setStartX(null);
    },
    [startX, threshold, onLeft, onRight]
  );
  return { isMobile, onTouchStart, onTouchEnd };
}
