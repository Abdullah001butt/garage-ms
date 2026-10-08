"use client";

import { createPortal } from "react-dom";
import { useState, useEffect } from "react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/types";
import { NAV_GROUPS } from "@/lib/nav-data";
import { NavLinks } from "@/components/NavLinks";
import { Icon } from "@/components/icons";

export function MobileNav({ role }: { role: Role | null }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isOwner = role === "owner";
  const groups = NAV_GROUPS.filter((g) => !g.ownerOnly || isOwner);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open navigation menu"
        className="md:hidden -ml-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-zinc-200 hover:bg-white/10"
      >
        <Icon name="menu" className="h-5 w-5" />
      </button>

      {open &&
        createPortal(
        <div className="md:hidden fixed inset-0 z-50 print:hidden">
          <div className="absolute inset-0 bg-zinc-950/30" onClick={() => setOpen(false)} aria-hidden="true" />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-graphite-950 shadow-2xl scheme-dark">
            <div className="flex h-14 items-center justify-between border-b border-graphite-800 px-4">
              <span className="flex h-10 items-center rounded-md bg-white px-2.5">
                <Image src="/logoalbahir.png" alt="Al Bahir Garage" width={160} height={36} className="h-7 w-auto object-contain" />
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation menu"
                className="flex h-9 w-9 items-center justify-center rounded-md text-zinc-400 hover:bg-white/10 hover:text-white"
              >
                <Icon name="x" className="h-5 w-5" />
              </button>
            </div>
            <NavLinks groups={groups} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      ,
          document.body
        )}
    </>
  );
}
