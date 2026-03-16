import type { Metadata } from "next";
import { Inter } from "next/font/google";
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
        <main id="main-content">
          {children}
        </main>
        <CookieConsentBanner />
      </body>
    </html>
  );
}
