'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Download, Share2, Trash2, CheckCircle, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiUrl } from '@/app/lib/apiRoot';

interface ComparisonSpec {
  label: string;
  key: string;
  category: string;
  format?: (value: any, listing: any) => string;
}

export default function ComparisonPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const [comparison, setComparison] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    fetchComparison();
  }, [params.id]);

  const fetchComparison = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login?redirect=/comparisons/' + params.id);
      return;
    }

    try {
      const response = await fetch(
        apiUrl(`/comparisons/${params.id}`),
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch comparison');
      }

      const data = await response.json();
      setComparison(data);
    } catch (error) {
      console.error('Failed to fetch comparison:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    const token = localStorage.getItem('token');
    try {
      const response = await fetch(
        apiUrl(`/comparisons/${params.id}`),
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        router.push('/account/comparisons');
      }
    } catch (error) {
      console.error('Failed to delete comparison:', error);
    }
  };

  const handleExportPDF = () => {
    // Simple print to PDF functionality
    window.print();
  };

  const handleShare = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: comparison.name,
        text: 'Check out this yacht comparison',
        url: url,
      });
    } else {
      navigator.clipboard.writeText(url);
      alert('Link copied to clipboard!');
    }
  };

  const specs: ComparisonSpec[] = [
    {
      category: 'Pricing',
      label: 'Price',
      key: 'price',
      format: (value, listing) =>
        value ? `${listing.currency || 'USD'} $${value.toLocaleString()}` : 'Contact for price',
    },
    {
      category: 'Basic Info',
      label: 'Year',
      key: 'year',
    },
    {
      category: 'Basic Info',
      label: 'Make',
      key: 'make',
    },
    {
      category: 'Basic Info',
      label: 'Model',
      key: 'model',
    },
    {
      category: 'Basic Info',
      label: 'Boat Type',
      key: 'boat_type',
    },
    {
      category: 'Dimensions',
      label: 'Length',
      key: 'length_feet',
      format: (v) => (v ? `${v} ft` : 'N/A'),
    },
    {
      category: 'Dimensions',
      label: 'Beam',
      key: 'beam_feet',
      format: (v) => (v ? `${v} ft` : 'N/A'),
    },
    {
      category: 'Dimensions',
      label: 'Draft',
      key: 'draft_feet',
      format: (v) => (v ? `${v} ft` : 'N/A'),
    },
    {
      category: 'Accommodations',
      label: 'Cabins',
      key: 'cabins',
    },
    {
      category: 'Accommodations',
      label: 'Berths',
      key: 'berths',
    },
    {
      category: 'Accommodations',
      label: 'Heads',
      key: 'heads',
    },
    {
      category: 'Engine & Performance',
      label: 'Engine Make',
      key: 'engine_make',
    },
    {
      category: 'Engine & Performance',
      label: 'Engine Model',
      key: 'engine_model',
    },
    {
      category: 'Engine & Performance',
      label: 'Engine Hours',
      key: 'engine_hours',
      format: (v) => (v ? `${v.toLocaleString()} hrs` : 'N/A'),
    },
    {
      category: 'Engine & Performance',
      label: 'Fuel Type',
      key: 'fuel_type',
    },
    {
      category: 'Engine & Performance',
      label: 'Hull Material',
      key: 'hull_material',
    },
    {
      category: 'Condition',
      label: 'Condition',
      key: 'condition',
      format: (v) => v ? v.charAt(0).toUpperCase() + v.slice(1) : 'N/A',
    },
    {
      category: 'Location',
      label: 'Location',
      key: 'city',
      format: (v, listing) =>
        v && listing.state ? `${v}, ${listing.state}` : v || 'N/A',
    },
  ];

  // Group specs by category
  const groupedSpecs = specs.reduce((acc, spec) => {
    if (!acc[spec.category]) {
      acc[spec.category] = [];
    }
    acc[spec.category].push(spec);
    return acc;
  }, {} as Record<string, ComparisonSpec[]>);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary border-t-transparent mx-auto mb-4" />
          <p className="text-gray-600">Loading comparison...</p>
        </div>
      </div>
    );
  }

  if (!comparison) {
    return (
      <div className="min-h-screen flex items-center justify-center section-light">
        <div className="text-center bg-white rounded-3xl shadow-lg border border-gray-200 p-12 max-w-md">
          <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-6">
            <X size={40} className="text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold text-secondary mb-2">Comparison Not Found</h2>
          <p className="text-dark/70 mb-6">This comparison doesn't exist or you don't have access to it.</p>
          <Link
            href="/account/comparisons"
            className="inline-flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all font-semibold"
          >
            <ArrowLeft size={20} />
            Back to Comparisons
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen section-light py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-secondary hover:text-primary transition-colors font-medium"
            >
              <ArrowLeft size={20} />
              Back
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={handleShare}
                className="flex items-center gap-2 px-4 py-2 bg-white border-2 border-gray-200 text-secondary rounded-xl hover:border-primary hover:text-primary transition-all font-semibold"
              >
                <Share2 size={18} />
                Share
              </button>
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all font-semibold shadow-lg hover:shadow-xl"
              >
                <Download size={18} />
                Export PDF
              </button>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-red-50 border-2 border-red-200 text-red-600 rounded-xl hover:bg-red-100 transition-all font-semibold"
              >
                <Trash2 size={18} />
                Delete
              </button>
            </div>
          </div>

          <h1 className="text-4xl font-bold text-secondary mb-2">{comparison.name}</h1>
          <p className="text-dark/70">
            Comparing {comparison.listings?.length || 0} yachts • Created {new Date(comparison.created_at).toLocaleDateString()}
          </p>
        </div>

        {/* Comparison Table */}
        <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-gray-200">
                  <th className="p-6 text-left font-bold bg-gradient-to-br from-gray-50 to-white sticky left-0 z-20 border-r border-gray-200">
                    <span className="text-secondary text-lg">Specifications</span>
                  </th>
                  {comparison.listings.map((listing: any, idx: number) => (
                    <th
                      key={listing.id}
                      className="p-6 min-w-[280px] text-left bg-gradient-to-br from-primary/5 to-white"
                    >
                      <Link
                        href={`/listings/${listing.id}`}
                        className="block group"
                      >
                        <div className="relative mb-3 rounded-xl overflow-hidden">
                          <img
                            src={listing.images?.[0]?.url || listing.images?.[0] || '/images/listing-fallback.png'}
                            className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-300"
                            alt={listing.title}
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <p className="font-bold text-gray-900 group-hover:text-primary transition-colors line-clamp-2 mb-1">
                          {listing.title}
                        </p>
                        <p className="text-sm text-secondary/70">
                          {listing.year} • {listing.length_feet}ft
                        </p>
                      </Link>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {Object.entries(groupedSpecs).map(([category, categorySpecs]) => (
                  <>
                    {/* Category Header */}
                    <tr key={`category-${category}`} className="bg-gradient-to-r from-primary/10 to-primary/5 border-y border-primary/20">
                      <td
                        colSpan={comparison.listings.length + 1}
                        className="p-4 font-bold text-secondary uppercase text-sm tracking-wider"
                      >
                        {category}
                      </td>
                    </tr>

                    {/* Category Specs */}
                    {categorySpecs.map((spec) => (
                      <tr
                        key={spec.key}
                        className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                      >
                        <td className="p-4 font-semibold text-secondary bg-gray-50/50 sticky left-0 z-10 border-r border-gray-100">
                          {spec.label}
                        </td>
                        {comparison.listings.map((listing: any) => {
                          const value = listing[spec.key];
                          const formattedValue = spec.format
                            ? spec.format(value, listing)
                            : value ?? 'N/A';
                          
                          return (
                            <td
                              key={listing.id}
                              className="p-4 text-gray-900"
                            >
                              {formattedValue}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </>
                ))}

                {/* Actions Row */}
                <tr className="bg-gradient-to-br from-gray-50 to-white border-t-2 border-gray-200">
                  <td className="p-6 font-semibold text-secondary sticky left-0 bg-gray-50 border-r border-gray-200">
                    Quick Actions
                  </td>
                  {comparison.listings.map((listing: any) => (
                    <td key={listing.id} className="p-6">
                      <div className="flex flex-col gap-2">
                        <Link
                          href={`/listings/${listing.id}`}
                          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all text-center font-semibold text-sm"
                        >
                          View Details
                        </Link>
                        {listing.dealer && (
                          <Link
                            href={`/dealers/${listing.dealer.slug || listing.dealer.id}`}
                            className="px-4 py-2 bg-secondary text-white rounded-lg hover:bg-secondary/90 transition-all text-center font-semibold text-sm"
                          >
                            Contact Dealer
                          </Link>
                        )}
                      </div>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Helpful Tips */}
        <div className="mt-8 bg-primary/5 border border-primary/20 rounded-2xl p-6">
          <h3 className="font-bold text-secondary mb-3 flex items-center gap-2">
            <CheckCircle className="text-primary" size={20} />
            Comparison Tips
          </h3>
          <ul className="space-y-2 text-sm text-dark/70">
            <li>• Click on any yacht image or title to view full details</li>
            <li>• Use the "Export PDF" button to save this comparison for later</li>
            <li>• Contact dealers directly from the quick actions at the bottom</li>
            <li>• Share this comparison with family or friends using the share button</li>
          </ul>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
            <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
              <Trash2 className="text-red-600" size={32} />
            </div>
            
            <h3 className="text-2xl font-bold text-secondary text-center mb-3">
              Delete Comparison?
            </h3>
            
            <p className="text-dark/70 text-center mb-8">
              Are you sure you want to delete "{comparison.name}"? This action cannot be undone.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="flex-1 px-6 py-3 border-2 border-gray-200 text-secondary rounded-xl hover:bg-gray-50 transition-all font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="flex-1 px-6 py-3 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all font-semibold"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}