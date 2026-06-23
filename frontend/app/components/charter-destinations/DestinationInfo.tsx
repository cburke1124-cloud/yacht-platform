'use client';

import { Destination } from '@/app/lib/destinationData';
import { Check, Users, Anchor } from 'lucide-react';

interface DestinationInfoProps {
  destination: Destination;
}

export default function DestinationInfo({ destination }: DestinationInfoProps) {
  return (
    <div className="w-full bg-white py-14 md:py-18">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          {/* Left: Description */}
          <div>
            <h2 className="text-3xl font-bold text-[#10214F] mb-4" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>
              About {destination.name}
            </h2>
            <div className="prose prose-sm max-w-none text-gray-700 space-y-4 font-poppins">
              {destination.longDescription.split('\n\n').map((para, idx) => (
                <p key={idx} className="leading-relaxed">
                  {para}
                </p>
              ))}
            </div>
          </div>

          {/* Right: Highlights */}
          <div className="space-y-6">
            {/* What to Expect */}
            <div className="bg-[#F8F9FC] border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Anchor className="text-[#01BBDC]" size={24} />
                <h3 className="text-2xl font-bold text-[#10214F]" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>
                  What to Expect
                </h3>
              </div>
              <ul className="space-y-3">
                {destination.whatToExpect.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <Check size={20} className="text-[#01BBDC] mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700 font-poppins">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Best For */}
            <div className="bg-[#F8F9FC] border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <Users className="text-[#01BBDC]" size={24} />
                <h3 className="text-2xl font-bold text-[#10214F]" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>
                  Best For
                </h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {destination.bestFor.map((tag) => (
                  <span
                    key={tag}
                    className="inline-block px-4 py-2 text-sm font-medium"
                    style={{ backgroundColor: 'rgba(1, 187, 220, 0.1)', color: '#01BBDC', border: '1px solid rgba(1, 187, 220, 0.3)' }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
