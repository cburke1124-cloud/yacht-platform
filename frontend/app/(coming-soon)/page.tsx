'use client';

import Image from 'next/image';

export default function ComingSoonPage() {
  return (
    <main className="relative min-h-screen w-full overflow-hidden">
      {/* Background hero image */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/images/hero-yacht.png"
          alt="Luxury yacht"
          fill
          className="object-cover object-right-bottom"
          quality={90}
          priority
        />
      </div>

      {/* Gradient overlay - white fade from left to right */}
      <div
        className="absolute inset-0 z-10 pointer-events-none"
        style={{
          background:
            'linear-gradient(90deg, #FFFFFF 0%, #FFFFFF 20%, rgba(255,255,255,0.95) 40%, rgba(255,255,255,0.7) 60%, rgba(255,255,255,0.3) 80%, rgba(255,255,255,0) 100%)',
        }}
      />

      {/* Content */}
      <div className="relative z-20 min-h-screen flex items-center justify-center">
        <div className="max-w-3xl px-6 sm:px-8 lg:px-12 py-12">
          {/* Main heading */}
          <h1
            className="font-bold text-4xl sm:text-5xl lg:text-6xl leading-tight mb-8"
            style={{
              color: '#10214F',
              fontFamily: 'Bahnschrift, DIN Alternate, sans-serif',
            }}
          >
            A Simpler Way to{' '}
            <span style={{ color: '#01BBDC' }}>Buy and Sell</span> Your Yacht
          </h1>

          {/* Description */}
          <p
            className="text-base sm:text-lg max-w-2xl"
            style={{
              color: '#10214F',
              fontFamily: 'Poppins, sans-serif',
              lineHeight: '1.7',
            }}
          >
            YachtVersal is building the global marketplace that removes complexity from buying and selling yachts. 
            A smarter way to search, connect, and move forward with confidence.
          </p>
        </div>
      </div>
    </main>
  );
}
