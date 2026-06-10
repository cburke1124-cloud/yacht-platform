'use client';

import { Destination } from '@/app/lib/destinationData';
import { Check, Users, Anchor } from 'lucide-react';

interface DestinationInfoProps {
  destination: Destination;
}

export default function DestinationInfo({ destination }: DestinationInfoProps) {
  return (
    <div className="w-full bg-white py-12 md:py-16">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid md:grid-cols-2 gap-12">
          {/* Left: Description */}
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">About {destination.name}</h2>
            <div className="prose prose-sm max-w-none text-gray-700 space-y-4">
              {destination.longDescription.split('\n\n').map((para, idx) => (
                <p key={idx} className="leading-relaxed">
                  {para}
                </p>
              ))}
            </div>
          </div>

          {/* Right: Highlights */}
          <div className="space-y-8">
            {/* What to Expect */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Anchor className="text-blue-600" size={24} />
                <h3 className="text-2xl font-bold text-gray-900">What to Expect</h3>
              </div>
              <ul className="space-y-3">
                {destination.whatToExpect.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-3">
                    <Check size={20} className="text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Best For */}
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Users className="text-blue-600" size={24} />
                <h3 className="text-2xl font-bold text-gray-900">Best For</h3>
              </div>
              <div className="flex flex-wrap gap-2">
                {destination.bestFor.map((tag) => (
                  <span
                    key={tag}
                    className="inline-block px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium"
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
