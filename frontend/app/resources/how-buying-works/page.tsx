'use client';

import Link from 'next/link';
import { Check, Search, FileText, Shield, User } from 'lucide-react';

export default function HowBuyingWorksPage() {
  const steps = [
    {
      number: '01',
      label: 'Step 1: AI Powered Search',
      title: 'Describe What You\'re Looking For',
      subtitle: 'Let YachtVersal AI Do the Heavy Lifting',
      tags: ['Budget Range', 'Size or style', 'Cruising plans', 'Lifestyle', 'Location'],
      cta: 'Fewer clicks. Smarter results. Less guesswork.',
      image: '/images/ai-search-yacht.jpg',
      imageAlt: 'AI-powered yacht search interface',
      imageRight: true,
    },
    {
      number: '02',
      label: 'Step 2: Curated Selection',
      title: 'Explore Listings with Clarity',
      subtitle: 'Every YachtVersal listing is designed for clarity and confidence',
      checkmarks: [
        'Professional photography and video',
        'Clear specifications and features',
        'Pricing transparency',
        'Broker information upfront',
      ],
      filterTags: ['Recommended', 'Best Value', 'Recently Listed', 'Featured Yachts'],
      sampleListings: [
        { name: 'Ocean Majesty', size: '85 ft', location: 'Monaco', price: '$4,850,000' },
        { name: 'Azure Dream', size: '68 ft', location: 'Miami, FL', price: '$2,950,000' },
      ],
      imageRight: false,
    },
  ];

  const connectCards = [
    {
      icon: User,
      title: 'Contact Brokers',
      description: 'Directly message listing agents to schedule viewings or ask specific questions.',
    },
    {
      icon: Shield,
      title: 'Ask Securely',
      description: 'Your identity is protected until you decide to share your details. No spam.',
    },
    {
      icon: FileText,
      title: 'Request Docs',
      description: 'Get surveys, maintenance logs, and ownership history with one click.',
    },
  ];

  const closeSteps = [
    { number: '01', title: 'Schedule Showing', desc: 'Book in-person or virtual tours seamlessly.' },
    { number: '02', title: 'Request Surveys', desc: 'Order independent inspections from certified experts.' },
    { number: '03', title: 'Narrow Options', desc: 'Compare finalists side-by-side with our tools.' },
  ];

  const differences = [
    'AI-powered yacht discovery instead of endless filters',
    'Global listings in one trusted marketplace',
    'Transparent, professional presentation',
    'Support representatives available throughout the journey',
    'No unnecessary steps or outdated processes',
  ];

  return (
    <main className="relative bg-white">
      {/* ─── HERO ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden" style={{ minHeight: 516 }}>
        {/* Background image with gradient overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/images/buying-hero.jpg')", backgroundPosition: 'right center' }}
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, #FFFFFF 0%, #FFFFFF 25%, rgba(255,255,255,0) 70%)' }} />
        <div className="absolute top-0 left-0 right-0 h-28" style={{ background: 'linear-gradient(90deg, #FFFFFF 0%, #FFFFFF 6%, rgba(255,255,255,0) 70%)' }} />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col justify-center" style={{ minHeight: 516 }}>
          <div className="max-w-xl pt-24 pb-16">
            <h1 className="text-5xl md:text-6xl font-bold mb-4 leading-tight" style={{ color: '#10214F', fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>
              Buying a Yacht<br />Made Simple
            </h1>
            <p className="text-base" style={{ color: '#10214F', fontFamily: 'Poppins, sans-serif' }}>
              Buying a yacht shouldn't feel complicated, overwhelming, or outdated.
            </p>
          </div>
        </div>
      </section>

      {/* ─── STEP 1: AI POWERED SEARCH ────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Image */}
            <div className="rounded-2xl overflow-hidden shadow-xl bg-gray-100" style={{ minHeight: 415 }}>
              <div
                className="w-full h-full min-h-[415px] bg-cover bg-center rounded-2xl"
                style={{ backgroundImage: "url('/images/ai-search-yacht.jpg')" }}
              />
            </div>
            {/* Content */}
            <div>
              <p className="text-base mb-2 font-normal" style={{ color: '#01BBDC', fontFamily: 'Poppins, sans-serif' }}>
                Step 1: AI Powered Search
              </p>
              <h2 className="text-3xl font-semibold mb-3" style={{ color: '#10214F', fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>
                Describe What You're Looking For
              </h2>
              <p className="text-base mb-6" style={{ color: '#10214F', fontFamily: 'Poppins, sans-serif' }}>
                Let YachtVersal AI Do the Heavy Lifting
              </p>
              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-8">
                {['Budget Range', 'Size or style', 'Cruising plans', 'Lifestyle', 'Location'].map((tag) => (
                  <span
                    key={tag}
                    className="px-4 py-2 rounded-full text-sm font-normal text-white"
                    style={{ backgroundColor: '#01BBDC', fontFamily: 'Poppins, sans-serif' }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
              {/* CTA Bar */}
              <div
                className="w-full py-3 px-6 rounded-xl text-white font-medium text-base text-center"
                style={{ backgroundColor: '#10214F', fontFamily: 'Poppins, sans-serif' }}
              >
                Fewer clicks. Smarter results. Less guesswork.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── STEP 2: CURATED SELECTION ────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            {/* Content */}
            <div>
              <p className="text-base mb-2" style={{ color: '#01BBDC', fontFamily: 'Poppins, sans-serif' }}>
                Step 2: Curated Selection
              </p>
              <h2 className="text-3xl font-semibold mb-3" style={{ color: '#10214F', fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>
                Explore Listings with Clarity
              </h2>
              <p className="text-base mb-6" style={{ color: '#10214F', fontFamily: 'Poppins, sans-serif' }}>
                Every YachtVersal listing is designed for clarity and confidence
              </p>
              {/* Checkmarks */}
              <ul className="space-y-4 mb-8">
                {['Professional photography and video', 'Clear specifications and features', 'Pricing transparency', 'Broker information upfront'].map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: '#01BBDC' }}>
                      <Check className="w-4 h-4 text-white" strokeWidth={3} />
                    </span>
                    <span className="text-base" style={{ color: '#10214F', fontFamily: 'Poppins, sans-serif' }}>{item}</span>
                  </li>
                ))}
              </ul>
              {/* Filter Tags */}
              <div className="flex flex-wrap gap-2">
                {['Recommended', 'Best Value', 'Recently Listed', 'Featured Yachts'].map((tag) => (
                  <span
                    key={tag}
                    className="px-4 py-2 rounded-full text-sm font-normal text-white"
                    style={{ backgroundColor: '#01BBDC', fontFamily: 'Poppins, sans-serif' }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
            {/* Sample Listing Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {/* Card 1 */}
              <div className="rounded-2xl border border-[#DBDBDB] overflow-hidden bg-white shadow-sm">
                <div
                  className="w-full h-48 bg-cover bg-center"
                  style={{ backgroundImage: "url('/images/yacht-monaco.jpg')" }}
                />
                <div className="p-4">
                  <h3 className="text-xl font-normal mb-2" style={{ color: '#10214F', fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>Ocean Majesty</h3>
                  <div className="flex items-center gap-4 mb-3 text-sm" style={{ color: '#10214F', fontFamily: 'Poppins, sans-serif' }}>
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="#01BBDC" strokeWidth="1.5"><path d="M3 17l4-8 4 4 4-6 4 6" /></svg>
                      85 ft
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="#01BBDC" strokeWidth="1.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" /><circle cx="12" cy="9" r="2.5" /></svg>
                      Monaco
                    </span>
                  </div>
                  <p className="text-xl font-bold" style={{ color: '#01BBDC', fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>$4,850,000</p>
                </div>
              </div>
              {/* Card 2 */}
              <div className="rounded-2xl border border-[#DBDBDB] overflow-hidden bg-white shadow-sm">
                <div
                  className="w-full h-48 bg-cover bg-center"
                  style={{ backgroundImage: "url('/images/yacht-miami.jpg')" }}
                />
                <div className="p-4">
                  <h3 className="text-xl font-normal mb-2" style={{ color: '#10214F', fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>Azure Dream</h3>
                  <div className="flex items-center gap-4 mb-3 text-sm" style={{ color: '#10214F', fontFamily: 'Poppins, sans-serif' }}>
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="#01BBDC" strokeWidth="1.5"><path d="M3 17l4-8 4 4 4-6 4 6" /></svg>
                      68 ft
                    </span>
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="#01BBDC" strokeWidth="1.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" /><circle cx="12" cy="9" r="2.5" /></svg>
                      Miami, FL
                    </span>
                  </div>
                  <p className="text-xl font-bold" style={{ color: '#01BBDC', fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>$2,950,000</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── STEP 3: CONNECT WITHOUT PRESSURE ────────────────────── */}
      <section className="py-20" style={{ backgroundColor: 'rgba(16,33,79,0.02)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            <div className="rounded-2xl overflow-hidden shadow-xl" style={{ minHeight: 562 }}>
              <div
                className="w-full h-full min-h-[562px] bg-cover bg-center rounded-2xl"
                style={{ backgroundImage: "url('/images/step-3-connect-without-pressure.jpg')" }}
              />
            </div>

            <div>
              <p className="text-base mb-2" style={{ color: '#01BBDC', fontFamily: 'Poppins, sans-serif' }}>
                Step 3: Take Action
              </p>
              <h2 className="text-3xl font-semibold mb-3" style={{ color: '#10214F', fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>
                Connect Without Pressure
              </h2>
              <p className="text-base mb-8 max-w-xl" style={{ color: '#10214F', fontFamily: 'Poppins, sans-serif' }}>
                When you find yachts you're interested in, YachtVersal makes connecting simple.
              </p>

              <div className="space-y-7 mb-10">
                <div className="flex items-start gap-4">
                  <User className="w-6 h-6 mt-1" style={{ color: '#01BBDC' }} />
                  <div>
                    <h3 className="text-3xl leading-none mb-2" style={{ color: '#10214F', fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>
                      Contact Brokers
                    </h3>
                    <p className="text-base" style={{ color: '#10214F', fontFamily: 'Poppins, sans-serif' }}>
                      Directly message listing agents to schedule viewings or ask specific questions.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <Shield className="w-6 h-6 mt-1" style={{ color: '#01BBDC' }} />
                  <div>
                    <h3 className="text-3xl leading-none mb-2" style={{ color: '#10214F', fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>
                      Ask Securely
                    </h3>
                    <p className="text-base" style={{ color: '#10214F', fontFamily: 'Poppins, sans-serif' }}>
                      Your identity is protected until you decide to share your details. No spam.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <FileText className="w-6 h-6 mt-1" style={{ color: '#01BBDC' }} />
                  <div>
                    <h3 className="text-3xl leading-none mb-2" style={{ color: '#10214F', fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>
                      Request Docs
                    </h3>
                    <p className="text-base" style={{ color: '#10214F', fontFamily: 'Poppins, sans-serif' }}>
                      Get surveys, maintenance logs, and ownership history with one click.
                    </p>
                  </div>
                </div>
              </div>

              <div
                className="w-full max-w-[526px] flex items-center gap-4 px-6 py-3 rounded-xl text-white"
                style={{ backgroundColor: '#10214F', fontFamily: 'Poppins, sans-serif' }}
              >
                <div
                  className="w-[68px] h-7 rounded-full bg-cover bg-center flex-shrink-0"
                  style={{ backgroundImage: "url('/images/step-3-support-strip.png')" }}
                  aria-hidden="true"
                >
                </div>
                <p className="text-base font-medium">We support the process. You stay in control.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── STEP 4: CLOSE THE DEAL ───────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Content */}
            <div>
              <p className="text-base mb-2" style={{ color: '#01BBDC', fontFamily: 'Poppins, sans-serif' }}>
                Step 4: Close the Deal
              </p>
              <h2 className="text-3xl font-semibold mb-2" style={{ color: '#10214F', fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>
                Move Forward at Your Pace
              </h2>
              <p className="text-base mb-10" style={{ color: '#10214F', fontFamily: 'Poppins, sans-serif' }}>
                Confident Decisions, Clear Next Steps
              </p>
              <div className="space-y-8">
                {closeSteps.map((s) => (
                  <div key={s.number} className="flex gap-6 items-start">
                    <span className="text-3xl font-semibold flex-shrink-0 w-12" style={{ color: '#01BBDC', fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>{s.number}</span>
                    <div>
                      <h3 className="text-2xl font-normal mb-1" style={{ color: '#10214F', fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>{s.title}</h3>
                      <p className="text-base" style={{ color: '#10214F', fontFamily: 'Poppins, sans-serif' }}>{s.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            {/* Image */}
            <div className="rounded-2xl overflow-hidden shadow-xl relative" style={{ minHeight: 493 }}>
              <div
                className="w-full h-full min-h-[493px] bg-cover bg-center rounded-2xl"
                style={{ backgroundImage: "url('/images/woman-relaxing-yacht.jpg')" }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ─── WHY YACHTVERSAL IS DIFFERENT ─────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Image */}
            <div className="rounded-2xl overflow-hidden shadow-xl" style={{ minHeight: 493 }}>
              <div
                className="w-full h-full min-h-[493px] bg-cover bg-center rounded-2xl"
                style={{ backgroundImage: "url('/images/cannes-luxury-yacht-port.jpg')" }}
              />
            </div>
            {/* Content */}
            <div>
              <h2 className="text-3xl font-semibold mb-2" style={{ color: '#10214F', fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>
                Why YachtVersal Is Different
              </h2>
              <p className="text-base mb-4" style={{ color: '#01BBDC', fontFamily: 'Poppins, sans-serif' }}>
                Built for Confidence, Not Complexity
              </p>
              <ul className="space-y-4 mb-8">
                {differences.map((item) => (
                  <li key={item} className="flex items-center gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: '#01BBDC' }}>
                      <Check className="w-4 h-4 text-white" strokeWidth={3} />
                    </span>
                    <span className="text-base" style={{ color: '#10214F', fontFamily: 'Poppins, sans-serif' }}>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="text-base leading-relaxed" style={{ color: '#10214F', fontFamily: 'Poppins, sans-serif', lineHeight: '1.875' }}>
                YachtVersal simplifies yacht buying by combining intelligent technology with human level clarity so you can focus on finding the right yacht, not navigating the process.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── BUYER'S GUIDE ────────────────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Content */}
            <div>
              <p className="text-base mb-2" style={{ color: '#01BBDC', fontFamily: 'Poppins, sans-serif' }}>
                Buyer's Guide
              </p>
              <h2 className="text-3xl font-semibold mb-6 leading-tight" style={{ color: '#10214F', fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>
                Everything You Need to Know about Buying Made Simple
              </h2>
              <p className="text-base mb-6 leading-relaxed" style={{ color: '#10214F', fontFamily: 'Poppins, sans-serif' }}>
                Buying a yacht is an exciting milestone, but it's also a significant investment with many moving parts. YachtVersal created this guide to help you understand the process clearly without confusion, pressure, or unnecessary complexity.
              </p>
              <p className="text-base leading-relaxed" style={{ color: '#10214F', fontFamily: 'Poppins, sans-serif' }}>
                From financing to delivery, this guide walks you through the key elements of yacht ownership so you can move forward confidently.
              </p>
            </div>
            {/* Image */}
            <div className="rounded-2xl overflow-hidden shadow-xl" style={{ minHeight: 493 }}>
              <div
                className="w-full h-full min-h-[493px] bg-cover bg-center rounded-2xl"
                style={{ backgroundImage: "url('/images/couple-relaxing.jpg')" }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA SECTION ──────────────────────────────────────────── */}
      <section className="relative overflow-hidden" style={{ minHeight: 479 }}>
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/images/elegant-yacht-lagoon.jpg')" }}
        />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(90deg, #FFFFFF 0%, rgba(255,255,255,0.95) 41%, rgba(255,255,255,0) 70%)' }}
        />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col justify-center" style={{ minHeight: 479 }}>
          <div className="max-w-lg py-16">
            <h2 className="text-4xl md:text-5xl font-normal mb-4" style={{ color: '#10214F', fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>
              Ready to Start?
            </h2>
            <p className="text-base mb-1" style={{ color: '#01BBDC', fontFamily: 'Poppins, sans-serif' }}>
              Find the Right Yacht—Without Endless Filters
            </p>
            <p className="text-base mb-8" style={{ color: '#10214F', fontFamily: 'Poppins, sans-serif' }}>
              Describe what you're looking for and let YachtVersal guide the way.
            </p>
            <Link
              href="/listings"
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl text-white font-medium text-base transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#01BBDC', fontFamily: 'Poppins, sans-serif' }}
            >
              View All Listings
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}