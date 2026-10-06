import React, { useRef, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";

const THRESHOLD = 70;
const MAX_PULL = 100;

export default function PullToRefresh({ onRefresh, children }) {
  const startYRef = useRef(null);
  const pullingRef = useRef(false);
  const [pullDist, setPullDist] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const handleTouchStart = useCallback((e) => {
    if (refreshing) return;
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    if (scrollTop > 0) {
      startYRef.current = null;
      pullingRef.current = false;
      return;
    }
    startYRef.current = e.touches[0].clientY;
    pullingRef.current = true;
  }, [refreshing]);

  const handleTouchMove = useCallback((e) => {
    if (!pullingRef.current || startYRef.current === null || refreshing) return;
    const delta = e.touches[0].clientY - startYRef.current;
    if (delta <= 0) {
      setPullDist(0);
      return;
    }
    // Prevent native pull-to-refresh while we're handling it
    if (delta > 5) {
      e.preventDefault();
    }
    const resisted = Math.min(MAX_PULL, delta * 0.5);
    setPullDist(resisted);
  }, [refreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!pullingRef.current) return;
    pullingRef.current = false;
    startYRef.current = null;
    if (pullDist >= THRESHOLD && onRefresh) {
      setRefreshing(true);
      setPullDist(THRESHOLD);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPullDist(0);
      }
    } else {
      setPullDist(0);
    }
  }, [pullDist, onRefresh]);

  const showSpinner = refreshing || pullDist >= THRESHOLD;
  const spinnerSize = Math.min(24, 12 + (pullDist / THRESHOLD) * 12);

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className="pointer-events-none fixed left-1/2 z-50 flex -translate-x-1/2 items-center justify-center transition-opacity"
        style={{
          top: pullDist > 0 ? `${pullDist}px` : "0px",
          opacity: pullDist > 0 ? 1 : 0,
        }}
      >
        <Loader2
          className="text-muted-foreground"
          style={{
            width: spinnerSize,
            height: spinnerSize,
            animation: showSpinner ? "spin 0.8s linear infinite" : "none",
          }}
        />
      </div>
      <div
        style={{
          transform: pullDist > 0 && !refreshing ? `translateY(${pullDist}px)` : "none",
          transition: pullingRef.current ? "none" : "transform 0.2s ease-out",
        }}
      >
        {children}
      </div>
    </div>
  );
}