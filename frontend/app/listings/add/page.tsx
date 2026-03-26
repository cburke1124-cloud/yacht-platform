'use client';

import Link from 'next/link';
import { ArrowLeft, PenSquare, LinkIcon, Layers } from 'lucide-react';

const options = [
  {
    icon: <PenSquare size={32} className="text-secondary" />,
    title: 'CREATE LISTING MANUALLY',
    desc1: 'Enter your listing details manually, including photos, specifications, pricing, and descriptions.',
    desc2: 'This option gives you full control over how each listing appears and is ideal if you are adding listings one at a time.',
    href: '/listings/create',
  },
  {
    icon: <LinkIcon size={32} className="text-secondary" />,
    title: 'IMPORT SINGLE LISTING',
    desc1: 'Paste the link to a specific yacht listing from your website, and YachtVersal will automatically pull in the details, photos, and information for you.',
    desc2: 'This is the fastest way to add an individual listing without entering everything manually.',
    href: '/dashboard/bulk-tools?mode=scraper',
  },
  {
    icon: <Layers size={32} className="text-secondary" />,
    title: 'IMPORT BULK LISTINGS',
    desc1: 'Paste the link to your listings page on your website (where multiple yachts are shown), and YachtVersal will automatically import your listings in bulk.',
    desc2: 'This is the easiest way to add multiple listings at once.',
    href: '/dashboard/bulk-tools?mode=bulk',
  },
];

export default function AddListingPage() {
  return (
    <div className="min-h-screen bg-soft py-10 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Back */}
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-secondary transition-colors mb-8"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </Link>

        {/* Heading */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-secondary">Add a Listing</h1>
          <p className="text-gray-600 mt-2">Choose how you&apos;d like to add your listing to YachtVersal.</p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {options.map((card) => (
            <div
              key={card.title}
              className="flex flex-col border-2 border-secondary/20 rounded-xl overflow-hidden hover:border-primary/40 transition-colors bg-white"
            >
              <div className="p-6 flex-1">
                <div className="flex justify-center mb-4">{card.icon}</div>
                <h3 className="font-bold text-secondary text-center text-sm tracking-wide mb-4">{card.title}</h3>
                <p className="text-sm text-gray-600 text-center mb-3">{card.desc1}</p>
                <p className="text-sm text-gray-600 text-center">{card.desc2}</p>
              </div>
              <div className="p-4 pt-0">
                <Link
                  href={card.href}
                  className="block w-full py-3 bg-secondary text-white font-bold text-sm tracking-widest rounded-lg hover:bg-primary transition-colors text-center"
                >
                  LET&apos;S GO!
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
