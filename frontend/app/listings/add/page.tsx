'use client';

import Link from 'next/link';
import { ArrowLeft, PenSquare, LinkIcon, Layers, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

const options = [
  {
    icon: PenSquare,
    color: 'from-blue-50 to-indigo-50',
    iconColor: 'text-secondary',
    accentColor: '#10214F',
    title: 'Add a Listing',
    subtitle: 'Full control over every detail',
    desc: 'Enter photos, specs, pricing and descriptions yourself. Ideal for adding listings one at a time with complete customisation.',
    href: '/listings/create',
    cta: 'Start Building',
  },
  {
    icon: LinkIcon,
    color: 'from-cyan-50 to-sky-50',
    iconColor: 'text-primary',
    accentColor: '#01BBDC',
    title: 'Import Single Listing',
    subtitle: 'Paste a link, we do the rest',
    desc: 'Paste the URL of a specific yacht on your website and YachtVersal automatically pulls in photos, specs, and details.',
    href: '/dashboard/bulk-tools?mode=scraper',
    cta: 'Import Now',
  },
  {
    icon: Layers,
    color: 'from-emerald-50 to-teal-50',
    iconColor: 'text-emerald-600',
    accentColor: '#059669',
    title: 'Website Scraper',
    subtitle: 'Import your full inventory at once',
    desc: 'Point YachtVersal at your listings page and let the scraper pull in all your boats automatically — the fastest way to get started.',
    href: '/dashboard/bulk-tools?mode=scraper',
    cta: 'Open Scraper',
  },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1 } },
};

const item = {
  hidden: { opacity: 0, y: 28 },
  show:   { opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } },
};

export default function AddListingPage() {
  return (
    <div className="min-h-screen bg-white py-12 px-4">
      <div className="max-w-4xl mx-auto">

        {/* Back */}
        <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.35 }}>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-secondary transition-colors mb-10 group"
          >
            <ArrowLeft size={15} className="transition-transform group-hover:-translate-x-0.5" />
            Back to Dashboard
          </Link>
        </motion.div>

        {/* Heading */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.05 }}
          className="mb-10"
        >
          <h1 className="text-4xl font-bold text-secondary tracking-tight">Add a Listing</h1>
          <p className="text-gray-500 mt-2 text-base">Choose how you&apos;d like to add your listing to YachtVersal.</p>
        </motion.div>

        {/* Cards */}
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 md:grid-cols-3 gap-6"
        >
          {options.map((card) => {
            const Icon = card.icon;
            return (
              <motion.div key={card.title} variants={item}>
                <Link href={card.href} className="group block h-full">
                  <div className="relative h-full flex flex-col bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm transition-all duration-300 ease-out group-hover:-translate-y-2 group-hover:shadow-xl group-hover:border-transparent">

                    {/* Gradient top stripe */}
                    <div className={`h-1.5 w-full bg-gradient-to-r ${card.color}`} />

                    {/* Icon area */}
                    <div className={`mx-6 mt-6 mb-4 w-14 h-14 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center transition-transform duration-300 group-hover:scale-110`}>
                      <Icon size={26} className={card.iconColor} />
                    </div>

                    {/* Text */}
                    <div className="px-6 flex-1">
                      <h3 className="font-bold text-secondary text-lg mb-0.5">{card.title}</h3>
                      <p className="text-xs font-medium mb-3" style={{ color: card.accentColor }}>{card.subtitle}</p>
                      <p className="text-sm text-gray-500 leading-relaxed">{card.desc}</p>
                    </div>

                    {/* CTA */}
                    <div className="px-6 pb-6 mt-6">
                      <div
                        className="flex items-center justify-between w-full py-3 px-4 rounded-xl text-sm font-semibold text-white transition-all duration-200 group-hover:gap-3"
                        style={{ backgroundColor: card.accentColor }}
                      >
                        <span>{card.cta}</span>
                        <ArrowRight size={15} className="transition-transform duration-200 group-hover:translate-x-1" />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </div>
  );
}
