import Link from "next/link";
import Image from "next/image";
import type { Role } from "@/lib/types";
import { NAV_GROUPS } from "@/lib/nav-data";
import { NavLinks } from "@/components/NavLinks";

export function Sidebar({ role }: { role: Role | null }) {
  const isOwner = role === "owner";
  const groups = NAV_GROUPS.filter((g) => !g.ownerOnly || isOwner);
  return (
    <aside style={{ viewTransitionName: "app-sidebar" }} className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 border-r border-graphite-800 bg-graphite-950 scheme-dark print:hidden">
      <Link href="/today" className="flex h-14 shrink-0 items-center border-b border-graphite-800 bg-graphite-950 px-4">
        <span className="flex h-10 items-center rounded-md bg-white px-2.5 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]">
          <Image
            src="/logoalbahir.png"
            alt="Al Bahir Garage"
            width={220}
            height={48}
            className="h-7 w-auto object-contain"
            priority
          />
        </span>
      </Link>
      <NavLinks groups={groups} />
      <div className="border-t border-graphite-800 px-5 py-3">
        <p className="text-[11px] font-semibold uppercase leading-tight tracking-[0.12em] text-zinc-400">Al Bahir Vehicles Repair LLC</p>
        <p className="text-[11px] uppercase leading-tight tracking-[0.12em] text-zinc-500">Ajman, UAE</p>
      </div>
    </aside>
  );
}
