import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { Icon } from "@/components/icons";

// Contact details for customer-facing pages (visitors can't read shop settings).
export const SHOP_CONTACT = {
  name: "Al Bahir Vehicles Repair LLC",
  address: "Al Sana'a Street, New Industrial Area 2, Ajman, UAE",
  phone: "06-5208397",
  phoneHref: "tel:+97165208397",
  mobile: "055-3708833",
  mobileHref: "tel:+971553708833",
  whatsappHref: "https://wa.me/971553708833",
  website: "www.albahirgarage.com",
};

/** Frame for public pages (online booking, status tracker, history certificate). */
export function PublicShell({ children, active }: { children: ReactNode; active?: "book" | "portal" }) {
  const navClass = (key: "book" | "portal") =>
    `rounded-md px-3 py-1.5 text-[13px] font-medium transition-colors ${
      active === key ? "bg-zinc-100 text-zinc-900" : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
    }`;
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50">
      <header className="border-b border-zinc-200 bg-white print:hidden">
        <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/book" className="shrink-0">
            <Image src="/logoalbahir.png" alt="Al Bahir Garage" width={220} height={48} className="h-9 w-auto object-contain" priority />
          </Link>
          <nav className="flex items-center gap-1">
            <Link href="/book" className={navClass("book")}>
              Book a service
            </Link>
            <Link href="/portal" className={navClass("portal")}>
              Track my vehicle
            </Link>
            <a
              href={SHOP_CONTACT.phoneHref}
              className="ml-2 hidden items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-[13px] font-medium text-zinc-800 hover:bg-zinc-50 sm:inline-flex"
            >
              <Icon name="phone" className="h-3.5 w-3.5 text-zinc-500" />
              {SHOP_CONTACT.phone}
            </a>
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-zinc-200 bg-white print:hidden">
        <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8 text-[13px] text-zinc-600 sm:grid-cols-3 sm:px-6">
          <div>
            <p className="font-semibold text-zinc-900">{SHOP_CONTACT.name}</p>
            <p className="mt-1 flex items-start gap-1.5">
              <Icon name="map-pin" className="mt-0.5 h-3.5 w-3.5 text-zinc-400" />
              {SHOP_CONTACT.address}
            </p>
          </div>
          <div className="space-y-1">
            <a href={SHOP_CONTACT.phoneHref} className="flex items-center gap-1.5 hover:text-zinc-900">
              <Icon name="phone" className="h-3.5 w-3.5 text-zinc-400" />
              Workshop {SHOP_CONTACT.phone}
            </a>
            <a href={SHOP_CONTACT.mobileHref} className="flex items-center gap-1.5 hover:text-zinc-900">
              <Icon name="phone" className="h-3.5 w-3.5 text-zinc-400" />
              Mobile {SHOP_CONTACT.mobile}
            </a>
            <a href={SHOP_CONTACT.whatsappHref} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 hover:text-zinc-900">
              <Icon name="message" className="h-3.5 w-3.5 text-zinc-400" />
              WhatsApp us
            </a>
          </div>
          <div className="sm:text-right">
            <p>{SHOP_CONTACT.website}</p>
            <p className="mt-1 text-xs text-zinc-400">© {new Date().getFullYear()} {SHOP_CONTACT.name}</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
