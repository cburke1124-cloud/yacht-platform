'use client';

import { useState, useEffect } from 'react';
import { TrendingUp, Eye, Mail, DollarSign, Ship, Users, Calendar, BarChart3, Download, Filter } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

interface Listing {
  id: number;
  title: string;
  price: number;
  views: number;
  inquiries: number;
  created_at: string;
  status: string;
}

interface AnalyticsData {
  totalListings: number;
  activeListings: number;
  totalViews: number;
  totalInquiries: number;
  avgViewsPerListing: number;
  avgInquiriesPerListing: number;
  conversionRate: number;
  topPerformingListings: Listing[];
  recentActivity: any[];
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalListings: 0,
    activeListings: 0,
    totalViews: 0,
    totalInquiries: 0,
    avgViewsPerListing: 0,
    avgInquiriesPerListing: 0,
    conversionRate: 0,
    topPerformingListings: [],
    recentActivity: []
  });
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('30'); // days
  const [sortBy, setSortBy] = useState<'views' | 'inquiries'>('views');

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        window.location.href = '/login';
        return;
      }

      // Fetch user's listings
      const response = await fetch(apiUrl('/my-listings'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setListings(data);
        calculateAnalytics(data);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateAnalytics = (listingsData: Listing[]) => {
    const totalListings = listingsData.length;
    const activeListings = listingsData.filter(l => l.status === 'active').length;
    const totalViews = listingsData.reduce((sum, l) => sum + (l.views || 0), 0);
    const totalInquiries = listingsData.reduce((sum, l) => sum + (l.inquiries || 0), 0);
    const avgViewsPerListing = totalListings > 0 ? Math.round(totalViews / totalListings) : 0;
    const avgInquiriesPerListing = totalListings > 0 ? (totalInquiries / totalListings).toFixed(1) : 0;
    const conversionRate = totalViews > 0 ? ((totalInquiries / totalViews) * 100).toFixed(2) : 0;

    // Get top performing listings
    const topPerforming = [...listingsData]
      .sort((a, b) => {
        if (sortBy === 'views') return (b.views || 0) - (a.views || 0);
        return (b.inquiries || 0) - (a.inquiries || 0);
      })
      .slice(0, 5);

    setAnalytics({
      totalListings,
      activeListings,
      totalViews,
      totalInquiries,
      avgViewsPerListing,
      avgInquiriesPerListing: Number(avgInquiriesPerListing),
      conversionRate: Number(conversionRate),
      topPerformingListings: topPerforming,
      recentActivity: []
    });
  };

  const exportToCSV = () => {
    const headers = ['Title', 'Price', 'Views', 'Inquiries', 'Conversion Rate', 'Status', 'Created'];
    const rows = listings.map(l => [
      l.title,
      l.price,
      l.views || 0,
      l.inquiries || 0,
      l.views > 0 ? `${((l.inquiries / l.views) * 100).toFixed(2)}%` : '0%',
      l.status,
      new Date(l.created_at).toLocaleDateString()
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `yacht-analytics-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-soft flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-soft py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-dark">Analytics & Reports</h1>
              <p className="text-dark/60 mt-1">Track your listing performance and insights</p>
            </div>
            <div className="flex gap-3">
              <select
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
              >
                <option value="7">Last 7 days</option>
                <option value="30">Last 30 days</option>
                <option value="90">Last 90 days</option>
                <option value="365">Last year</option>
              </select>
              <button
                onClick={exportToCSV}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-light rounded-lg hover-primary transition-colors"
              >
                <Download size={18} />
                Export CSV
              </button>
            </div>
          </div>
        </div>

        {/* Key Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Total Listings */}
          <div className="bg-white rounded-xl shadow-sm border border-primary/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-primary/10 p-3 rounded-lg">
                <Ship className="text-primary" size={24} />
              </div>
              <span className="text-xs font-medium text-gray-500 uppercase">Total Listings</span>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">
              {analytics.totalListings}
            </div>
            <p className="text-sm text-gray-600">
              {analytics.activeListings} active
            </p>
          </div>

          {/* Total Views */}
          <div className="bg-white rounded-xl shadow-sm border border-primary/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-primary/10 p-3 rounded-lg">
                <Eye className="text-primary" size={24} />
              </div>
              <span className="text-xs font-medium text-gray-500 uppercase">Total Views</span>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">
              {analytics.totalViews.toLocaleString()}
            </div>
            <p className="text-sm text-gray-600">
              Avg {analytics.avgViewsPerListing} per listing
            </p>
          </div>

          {/* Total Inquiries */}
          <div className="bg-white rounded-xl shadow-sm border border-primary/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-primary/10 p-3 rounded-lg">
                <Mail className="text-primary" size={24} />
              </div>
              <span className="text-xs font-medium text-gray-500 uppercase">Total Inquiries</span>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">
              {analytics.totalInquiries}
            </div>
            <p className="text-sm text-gray-600">
              Avg {analytics.avgInquiriesPerListing} per listing
            </p>
          </div>

          {/* Conversion Rate */}
          <div className="bg-white rounded-xl shadow-sm border border-primary/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="bg-primary/10 p-3 rounded-lg">
                <TrendingUp className="text-primary" size={24} />
              </div>
              <span className="text-xs font-medium text-gray-500 uppercase">Conversion Rate</span>
            </div>
            <div className="text-3xl font-bold text-gray-900 mb-1">
              {analytics.conversionRate}%
            </div>
            <p className="text-sm text-gray-600">
              Views to inquiries
            </p>
          </div>
        </div>

        {/* Top Performing Listings */}
        <div className="bg-white rounded-xl shadow-sm border border-primary/10 mb-8">
          <div className="p-6 border-b border-primary/10">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-dark">Top Performing Listings</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setSortBy('views')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    sortBy === 'views'
                      ? 'bg-primary text-light'
                      : 'bg-soft text-dark hover:bg-soft/90'
                  }`}
                >
                  By Views
                </button>
                <button
                  onClick={() => setSortBy('inquiries')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    sortBy === 'inquiries'
                      ? 'bg-primary text-light'
                      : 'bg-soft text-dark hover:bg-soft/90'
                  }`}
                >
                  By Inquiries
                </button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-soft">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Listing
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Views
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Inquiries
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Conversion
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-primary/10">
                {analytics.topPerformingListings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-dark/60">
                      No listings yet. Create your first listing to see analytics.
                    </td>
                  </tr>
                ) : (
                  analytics.topPerformingListings.map((listing, index) => {
                    const conversion = listing.views > 0 
                      ? ((listing.inquiries / listing.views) * 100).toFixed(1)
                      : '0.0';
                    
                    return (
                      <tr key={listing.id} className="hover:bg-soft transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-sm">
                              #{index + 1}
                            </div>
                            <div>
                              <div className="font-medium text-dark">{listing.title}</div>
                              <div className="text-sm text-dark/60">
                                Listed {new Date(listing.created_at).toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">
                            ${listing.price?.toLocaleString() || 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Eye size={16} className="text-primary/70" />
                            <span className="text-sm font-medium text-dark">
                              {listing.views || 0}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Mail size={16} className="text-primary/70" />
                            <span className="text-sm font-medium text-dark">
                              {listing.inquiries || 0}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            parseFloat(conversion) >= 5
                              ? 'bg-accent/20 text-accent/80'
                              : parseFloat(conversion) >= 2
                              ? 'bg-primary/10 text-primary'
                              : 'bg-soft text-dark'
                          }`}>
                            {conversion}%
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            listing.status === 'active'
                              ? 'bg-primary/10 text-primary'
                              : 'bg-soft text-dark'
                          }`}>
                            {listing.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* All Listings Performance */}
        <div className="bg-white rounded-xl shadow-sm border border-primary/10">
          <div className="p-6 border-b border-primary/10">
            <h2 className="text-xl font-bold text-dark">All Listings Performance</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-soft">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Listing
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Views
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Inquiries
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-primary/10">
                {listings.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center">
                      <Ship className="mx-auto text-secondary/40 mb-4" size={48} />
                      <h3 className="text-lg font-semibold text-dark mb-2">No listings yet</h3>
                      <p className="text-dark/60 mb-4">Create your first listing to start tracking analytics</p>
                      <a
                        href="/listings/create"
                        className="inline-block px-6 py-3 bg-primary text-light rounded-lg hover-primary transition-colors"
                      >
                        Create Listing
                      </a>
                    </td>
                  </tr>
                ) : (
                  listings.map((listing) => (
                    <tr key={listing.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-medium text-dark">{listing.title}</div>
                        <div className="text-sm text-dark/60">
                          Created {new Date(listing.created_at).toLocaleDateString()}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          ${listing.price?.toLocaleString() || 'N/A'}
                        </div>
                      </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Eye size={16} className="text-primary/70" />
                            <span className="text-sm text-dark">{listing.views || 0}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <Mail size={16} className="text-primary/70" />
                            <span className="text-sm text-dark">{listing.inquiries || 0}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          listing.status === 'active'
                            ? 'bg-primary/10 text-primary'
                            : listing.status === 'draft'
                            ? 'bg-accent/20 text-accent/80'
                            : 'bg-soft text-dark'
                        }`}>
                          {listing.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <a
                          href={`/listings/${listing.id}`}
                          className="text-primary hover:text-primary/90 font-medium"
                        >
                          View Details →
                        </a>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Insights & Recommendations */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gradient-to-br from-primary/10 to-primary/20 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-primary p-2 rounded-lg">
                <TrendingUp className="text-white" size={20} />
              </div>
              <h3 className="text-lg font-bold text-dark">Performance Insights</h3>
            </div>
            <ul className="space-y-2 text-sm text-dark/80">
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Your average conversion rate is {analytics.conversionRate}%. Industry average is 3-5%.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Listings with professional photos get 40% more inquiries.</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary">•</span>
                <span>Featured listings receive 3x more views on average.</span>
              </li>
            </ul>
          </div>

          <div className="bg-gradient-to-br from-accent/10 to-accent/20 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-accent p-2 rounded-lg">
                <BarChart3 className="text-white" size={20} />
              </div>
              <h3 className="text-lg font-bold text-dark">Quick Stats</h3>
            </div>
            <div className="space-y-3 text-dark/80">
              <div className="flex justify-between items-center">
                <span className="text-sm">Active vs Total</span>
                <span className="font-bold text-dark">
                  {analytics.activeListings}/{analytics.totalListings}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Engagement Score</span>
                <span className="font-bold text-dark">
                  {analytics.totalViews > 0 ? 'Good' : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Avg Response Time</span>
                <span className="font-bold text-dark">Coming Soon</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}