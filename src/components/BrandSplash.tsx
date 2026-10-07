"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const SEEN_KEY = "albahir-splash-seen";

/**
 * Branded loading screen shown while the app first loads: the Al Bahir logo
 * with a thin red progress sweep, fading into the app once ready. The first
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
      <div className="mt-7 h-[3px] w-44 overflow-hidden rounded-full bg-zinc-100">
        <div className="splash-bar h-full w-2/5 rounded-full bg-brand-600" />
      </div>
      <p className="mt-4 text-[11px] font-medium uppercase tracking-[0.22em] text-zinc-400">Workshop Management System</p>
    </div>
  );
}
