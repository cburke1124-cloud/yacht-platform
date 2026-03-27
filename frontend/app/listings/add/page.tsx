'use client';

import Link from 'next/link';
import { ArrowLeft, PenSquare, LinkIcon, Layers } from 'lucide-react';

const options = [
  {
    icon: PenSquare,
    title: 'CREATE LISTING MANUALLY',
    desc1: 'Enter your listing details manually, including photos, specifications, pricing, and descriptions.',
    desc2: 'This option gives you full control over how each listing appears and is ideal if you are adding listings one at a time.',
    href: '/listings/create',
  },
  {
    icon: LinkIcon,
    title: 'IMPORT SINGLE LISTING',
    desc1: 'Paste the link to a specific yacht listing from your website, and YachtVersal will automatically pull in the details, photos, and information for you.',
    desc2: 'Use the direct URL for an actual vessel page — not your homepage or a page showing multiple listings.',
    href: '/dashboard/bulk-tools?mode=scraper',
  },
  {
    icon: Layers,
    title: 'IMPORT BULK LISTINGS',
    desc1: 'Paste the link to your listings page on your website (where multiple yachts are shown), and YachtVersal will automatically import your listings in bulk.',
    desc2: 'This is the easiest way to add multiple listings at once.',
    href: '/dashboard/bulk-tools?mode=bulk',
  },
];

export default function AddListingPage() {
  return (
    <div className="min-h-screen bg-white py-12 px-4">
      <div className="max-w-3xl mx-auto">

        {/* Back */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-secondary transition-colors mb-10 group"
        >
          <ArrowLeft size={15} className="transition-transform group-hover:-translate-x-0.5" />
          Back to Dashboard
        </Link>

        {/* Heading */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-secondary">Set Up Your Listings</h1>
          <p className="text-sm text-primary italic mt-1 mb-1">Choose how you&apos;d like to add your listings to YachtVersal.</p>
          <p className="text-sm text-gray-600">
            Let&apos;s get your listings set up. You can choose the method that works best for you — whether you want to
            enter listings manually or import them directly from your website.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {options.map((card) => {
            const Icon = card.icon;
            return (
              <Link key={card.title} href={card.href} className="flex flex-col border-2 border-secondary/20 rounded-xl overflow-hidden hover:border-primary/40 transition-colors">
                <div className="p-6 flex-1">
                  <div className="flex justify-center mb-4">
                    <Icon size={28} className="text-secondary" />
                  </div>
                  <h3 className="font-bold text-secondary text-center text-sm tracking-wide mb-4">{card.title}</h3>
                  <p className="text-sm text-gray-600 text-center mb-3">{card.desc1}</p>
                  <p className="text-sm text-gray-600 text-center">{card.desc2}</p>
                </div>
                <div className="p-4 pt-0">
                  <div className="w-full py-3 bg-secondary text-white font-bold text-sm tracking-widest rounded-lg hover:bg-primary transition-colors text-center">
                    LET&apos;S GO!
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

      </div>
    </div>
  );
}

