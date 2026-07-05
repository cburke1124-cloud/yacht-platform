import type { Metadata } from "next";
import Script from "next/script";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import CookieConsentBanner from "./components/CookieConsentBanner";
import LayoutShell from "./components/LayoutShell";
import AuthGuard from "./components/AuthGuard";

const inter = Inter({ subsets: ["latin"] });

const poppins = Poppins({ 
  weight: ['400', '500', '600', '700'],
  subsets: ["latin"],
  variable: '--font-poppins',
  display: 'swap',
});

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/+$/, '')) || 'https://www.yachtversal.com';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "YachtVersal - Yacht Marketplace",
    template: "%s | YachtVersal",
  },
  description: "Buy and sell luxury yachts. Browse listings from trusted brokers and private sellers, explore boat types, makes, and charter destinations.",
  openGraph: {
    type: "website",
    siteName: "YachtVersal",
    title: "YachtVersal - Yacht Marketplace",
    description: "Buy and sell luxury yachts. Browse listings from trusted brokers and private sellers, explore boat types, makes, and charter destinations.",
    images: [{ url: "/images/hero-yacht2.png", width: 1200, height: 630, alt: "YachtVersal" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "YachtVersal - Yacht Marketplace",
    description: "Buy and sell luxury yachts. Browse listings from trusted brokers and private sellers, explore boat types, makes, and charter destinations.",
    images: ["/images/hero-yacht2.png"],
  },
};

// Sitewide structured data: Organization (identity, logo, socials) and
// WebSite with a SearchAction, which is what makes Google eligible to show a
// sitelinks search box for the domain.
const ORGANIZATION_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'YachtVersal',
  url: SITE_URL,
  logo: `${SITE_URL}/logo/logo-full.png`,
  email: 'info@yachtversal.com',
  sameAs: [
    'https://www.facebook.com/profile.php?id=61579522401665',
    'https://www.instagram.com/yachtversal/',
    'https://www.linkedin.com/company/112766298/',
  ],
};

const WEBSITE_JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'YachtVersal',
  url: SITE_URL,
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: `${SITE_URL}/listings?search={search_term_string}`,
    },
    'query-input': 'required name=search_term_string',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={poppins.variable}>
      <head>
        {/* Google Tag Manager */}
        <Script id="gtm-script" strategy="beforeInteractive">{`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-PC4GRQR2');`}</Script>
        {/* End Google Tag Manager */}
        {/* Google tag (gtag.js) */}
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-4DLZQWFYLV" />
        <script dangerouslySetInnerHTML={{ __html: `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-4DLZQWFYLV');
        `}} />
        {/* End Google tag */}
      </head>
      <body className={inter.className} suppressHydrationWarning>
        {/* Google Tag Manager (noscript) */}
        <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-PC4GRQR2" height="0" width="0" style={{display:'none',visibility:'hidden'}}></iframe></noscript>
        {/* End Google Tag Manager (noscript) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ORGANIZATION_JSON_LD) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_JSON_LD) }}
        />
        {/* Mounted first so its effect patches window.fetch before any other
            component's mount-time fetch calls (e.g. Navbar's auth check) run. */}
        <AuthGuard />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-lg focus:text-sm focus:font-medium"
        >
          Skip to main content
        </a>
        <LayoutShell navbar={<Navbar />} footer={<Footer />}>
          <main id="main-content">
            {children}
          </main>
        </LayoutShell>
        <CookieConsentBanner />
        <Script
          src="https://widgets.leadconnectorhq.com/loader.js"
          strategy="afterInteractive"
          data-resources-url="https://widgets.leadconnectorhq.com/chat-widget/loader.js"
          data-widget-id="69cd7a636925f04180877cc6"
        />
      </body>
    </html>
  );
}