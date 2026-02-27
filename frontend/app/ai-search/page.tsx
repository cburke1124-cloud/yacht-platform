
import { Suspense } from 'react';
import AISearchComponent from '../components/AISearchComponent';

export default function AISearchPage() {
  return (
    <div className="min-h-screen bg-soft py-8">
      <div className="max-w-7xl mx-auto px-4">
        <Suspense fallback={<div className="min-h-screen bg-soft" />}>
          <AISearchComponent />
        </Suspense>
      </div>
    </div>
  );
}