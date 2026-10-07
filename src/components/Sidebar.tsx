import Link from "next/link";
import Image from "next/image";
import type { Role } from "@/lib/types";
import { NAV_GROUPS } from "@/lib/nav-data";
import { NavLinks } from "@/components/NavLinks";

export function Sidebar({ role }: { role: Role | null }) {
  const isOwner = role === "owner";
  const groups = NAV_GROUPS.filter((g) => !g.ownerOnly || isOwner);
  return (
    <aside style={{ viewTransitionName: "app-sidebar" }} className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 border-r border-zinc-200 bg-white print:hidden">
      <Link href="/today" className="flex h-14 shrink-0 items-center border-b border-zinc-200 px-5">
        <Image
          src="/logoalbahir.png"
          alt="Al Bahir Garage"
          width={220}
          height={48}
          className="h-8 w-auto object-contain"
          priority
        />
      </Link>
      <NavLinks groups={groups} />
      <div className="border-t border-zinc-200 px-5 py-3">
        <p className="text-[11px] leading-tight text-zinc-400">Al Bahir Vehicles Repair LLC</p>
        <p className="text-[11px] leading-tight text-zinc-400">Ajman, UAE</p>
      </div>
    </aside>
  );
}
