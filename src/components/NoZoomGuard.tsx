"use client";

import { useEffect } from "react";

export function NoZoomGuard() {
  useEffect(() => {
    function blockGesture(e: Event) {
      e.preventDefault();
    }
    function blockMultiTouchMove(e: TouchEvent) {
      if (e.touches.length > 1) e.preventDefault();
    }
    let lastTouchEnd = 0;
    function blockDoubleTapZoom(e: TouchEvent) {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) e.preventDefault();
      lastTouchEnd = now;
    }

    document.addEventListener("gesturestart", blockGesture);
    document.addEventListener("gesturechange", blockGesture);
    document.addEventListener("touchmove", blockMultiTouchMove, { passive: false });
    document.addEventListener("touchend", blockDoubleTapZoom, { passive: false });

    return () => {
      document.removeEventListener("gesturestart", blockGesture);
      document.removeEventListener("gesturechange", blockGesture);
      document.removeEventListener("touchmove", blockMultiTouchMove);
      document.removeEventListener("touchend", blockDoubleTapZoom);
    };
  }, []);

  return null;
}
