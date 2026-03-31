import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../globals.css";
import CookieConsentBanner from "../components/CookieConsentBanner";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "YachtVersal - Coming Soon",
  description: "YachtVersal is coming soon",
};

export default function ComingSoonLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className} suppressHydrationWarning>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-lg focus:text-sm focus:font-medium"
        >
          Skip to main content
        </a>
        <main id="main-content" className="min-h-screen">
          {children}
        </main>
        <CookieConsentBanner />
      </body>
    </html>
  );
}
