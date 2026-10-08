import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { Suspense } from "react";
import { NoZoomGuard } from "@/components/NoZoomGuard";
import { BrandSplash } from "@/components/BrandSplash";
import { RouteProgress } from "@/components/RouteProgress";
import { ToastProvider } from "@/components/Toast";
import { PeekHost } from "@/components/Peek";
import { QueryProvider } from "@/components/QueryProvider";
import { MobileNav } from "@/components/MobileNav";
import { GlobalSearch } from "@/components/GlobalSearch";
import { HelpBanner } from "@/components/HelpBanner";
import { getCurrentUserAndProfile } from "@/lib/auth";
import { signOut } from "@/app/login/actions";
import { Icon } from "@/components/icons";
import { PageTransition } from "@/components/PageTransition";
import { ContextMenuHost } from "@/components/ContextMenu";

function initials(name: string) {
  const parts = name.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// Showroom type: Barlow for the app, Barlow Condensed for titles and big numbers.
// Geist stays loaded for printed documents (invoices) so their layout never shifts.
const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Al Bahir Garage",
  description: "Garage management system for Al Bahir Garage",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { user, profile } = await getCurrentUserAndProfile();
  const role = profile?.role ?? null;

  return (
    <html
      lang="en"
      className={`${barlow.variable} ${barlowCondensed.variable} ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-zinc-50 text-zinc-900 overflow-x-hidden">
        <NoZoomGuard />
        <BrandSplash />
        <Suspense fallback={null}>
          <RouteProgress />
        </Suspense>
        <QueryProvider>
        <ToastProvider>
          {!user ? (
            children
          ) : (
            <>
              <Sidebar role={role} />
              <div className="md:pl-60 flex flex-col min-h-full">
                <header style={{ viewTransitionName: "app-header" }} className="sticky top-0 z-20 border-b border-graphite-800 bg-graphite-950 text-white print:hidden">
                  <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <MobileNav role={role} />
                      <div className="min-w-0 flex-1 max-w-md">
                        <GlobalSearch role={role} />
                      </div>
                    </div>
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="hidden min-w-0 items-center gap-2.5 sm:flex">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-graphite-800 text-xs font-semibold text-white ring-1 ring-white/10">
                          {initials(profile?.full_name ?? user.email ?? "")}
                        </span>
                        <div className="min-w-0 leading-tight">
                          <p className="truncate text-[13px] font-semibold text-white">{profile?.full_name ?? user.email}</p>
                          {role && <p className="text-[11px] uppercase tracking-[0.1em] text-zinc-400">{role}</p>}
                        </div>
                      </div>
                      <form action={signOut}>
                        <button
                          className="flex h-9 items-center gap-1.5 rounded-md px-2 text-[13px] font-medium text-zinc-400 hover:bg-white/10 hover:text-white"
                          aria-label="Sign out"
                        >
                          <Icon name="logout" className="h-4 w-4" />
                          <span className="hidden lg:inline">Sign out</span>
                        </button>
                      </form>
                    </div>
                  </div>
                </header>
                <main className="flex-1 min-w-0">
                  <div className="page pt-4! pb-0! print:hidden">
                    <HelpBanner />
                  </div>
                  <PageTransition>{children}</PageTransition>
                </main>
                <PeekHost />
                <ContextMenuHost />
              </div>
            </>
          )}
        </ToastProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
