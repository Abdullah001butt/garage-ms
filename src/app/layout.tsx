import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { Suspense } from "react";
import { NoZoomGuard } from "@/components/NoZoomGuard";
import { BrandSplash } from "@/components/BrandSplash";
import { RouteProgress } from "@/components/RouteProgress";
import { ToastProvider } from "@/components/Toast";
import { QueryProvider } from "@/components/QueryProvider";
import { MobileNav } from "@/components/MobileNav";
import { GlobalSearch } from "@/components/GlobalSearch";
import { HelpBanner } from "@/components/HelpBanner";
import { getCurrentUserAndProfile } from "@/lib/auth";
import { signOut } from "@/app/login/actions";
import { Icon } from "@/components/icons";

function initials(name: string) {
  const parts = name.replace(/@.*/, "").split(/[\s._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
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
                <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/85 backdrop-blur supports-backdrop-filter:bg-white/75 print:hidden">
                  <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <MobileNav role={role} />
                      <div className="min-w-0 flex-1 max-w-md">
                        <GlobalSearch role={role} />
                      </div>
                    </div>
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="hidden min-w-0 items-center gap-2.5 sm:flex">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-semibold text-white">
                          {initials(profile?.full_name ?? user.email ?? "")}
                        </span>
                        <div className="min-w-0 leading-tight">
                          <p className="truncate text-[13px] font-medium text-zinc-900">{profile?.full_name ?? user.email}</p>
                          {role && <p className="text-[11px] capitalize text-zinc-500">{role}</p>}
                        </div>
                      </div>
                      <form action={signOut}>
                        <button
                          className="flex h-9 items-center gap-1.5 rounded-md px-2 text-[13px] font-medium text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
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
                  {children}
                </main>
              </div>
            </>
          )}
        </ToastProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
