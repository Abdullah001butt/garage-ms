"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const SEEN_KEY = "albahir-splash-seen";

/**
 * Branded loading screen shown while the app first loads: the Al Bahir logo
 * over a rev counter whose needle climbs to the red line, fading into the app once ready. The first
 * load of a session holds it briefly so it reads as intentional; after that
 * it only stays as long as loading actually takes.
 */
export function BrandSplash() {
  const [phase, setPhase] = useState<"show" | "fade" | "gone">("show");

  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN_KEY) === "1";
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      // storage blocked (private mode) — just show the short version
    }
    const minVisible = seen ? 0 : 700;
    const started = performance.now();
    const timers: ReturnType<typeof setTimeout>[] = [];

    const finish = () => {
      const remaining = Math.max(0, minVisible - (performance.now() - started));
      timers.push(
        setTimeout(() => {
          setPhase("fade");
          timers.push(setTimeout(() => setPhase("gone"), 320));
        }, remaining)
      );
    };

    if (document.readyState === "complete") finish();
    else window.addEventListener("load", finish, { once: true });

    return () => {
      window.removeEventListener("load", finish);
      timers.forEach(clearTimeout);
    };
  }, []);

  if (phase === "gone") return null;

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center bg-white transition-opacity duration-300 print:hidden ${
        phase === "fade" ? "pointer-events-none opacity-0" : "opacity-100"
      }`}
    >
      <div className="splash-logo">
        <Image src="/logoalbahir.png" alt="" width={280} height={60} priority className="h-14 w-auto object-contain sm:h-16" />
      </div>
      <svg viewBox="0 0 150 92" className="mt-6 h-[88px] w-[144px] overflow-visible" aria-hidden="true">
        {/* track, red zone, ticks */}
        <path d="M15 78 A60 60 0 0 1 135 78" fill="none" stroke="#f1eeee" strokeWidth="8" strokeLinecap="round" />
        <path d="M117.4 35.6 A60 60 0 0 1 135 78" fill="none" stroke="#fbcbd0" strokeWidth="8" strokeLinecap="round" />
        <path className="splash-gauge-arc" d="M15 78 A60 60 0 0 1 135 78" fill="none" stroke="#d41f31" strokeWidth="8" strokeLinecap="round" pathLength={100} />
        <g stroke="#cfc8c9" strokeWidth="1.6" strokeLinecap="round">
          <line x1="75" y1="10" x2="75" y2="17" />
          <line x1="27" y1="30" x2="32" y2="35" />
          <line x1="123" y1="30" x2="118" y2="35" />
          <line x1="7" y1="78" x2="13" y2="78" opacity="0" />
        </g>
        <g className="splash-gauge-needle">
          <line x1="75" y1="78" x2="75" y2="30" stroke="#18181b" strokeWidth="3" strokeLinecap="round" />
          <circle cx="75" cy="78" r="6.5" fill="#18181b" />
          <circle cx="75" cy="78" r="2.2" fill="#d41f31" />
        </g>
      </svg>
      <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-400">Workshop Management System</p>
    </div>
  );
}
