import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/Sidebar";
import { getCurrentUserAndProfile } from "@/lib/auth";
import { signOut } from "@/app/login/actions";

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
      <body className="min-h-full bg-slate-50">
        {!user ? (
          children
        ) : (
          <>
            <Sidebar role={role} />
            <div className="md:pl-64 flex flex-col min-h-full">
              <header className="border-b border-slate-200 bg-white sticky top-0 z-10 print:hidden">
                <div className="flex items-center justify-between px-4 md:px-8 py-3">
                  <nav className="md:hidden flex items-center gap-4 overflow-x-auto text-sm font-medium text-slate-600">
                    <a href="/" className="font-semibold text-slate-900 shrink-0">
                      Al Bahir
                    </a>
                  </nav>
                  <div className="flex items-center gap-3 ml-auto">
                    <span className="text-sm text-slate-500">
                      {profile?.full_name ?? user.email}
                      {role && <span className="ml-1.5 text-xs text-slate-400">({role})</span>}
                    </span>
                    <form action={signOut}>
                      <button className="text-sm text-slate-500 hover:text-slate-900">
                        Sign out
                      </button>
                    </form>
                  </div>
                </div>
              </header>
              <main className="flex-1">{children}</main>
            </div>
          </>
        )}
      </body>
    </html>
  );
}
