'use client';

import DealerListingsManager from './DealerListingsManager';

export default function ListingsPage() {
  return (
    <div className="min-h-screen bg-soft">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DealerListingsManager />
      </div>
    </div>
  );
}
