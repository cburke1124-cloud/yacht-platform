'use client';

import type { CSSProperties } from 'react';

// Base Skeleton Component
export function Skeleton({ className = '', width, height, style }: { 
  className?: string; 
  width?: string; 
  height?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={`animate-pulse bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 bg-[length:200%_100%] rounded ${className}`}
      style={{ 
        width, 
        height,
        animation: 'shimmer 2s infinite',
        ...style
      }}
    />
  );
}

// Listing Card Skeleton
export function ListingCardSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      {/* Image */}
      <Skeleton className="w-full h-48" />
      
      {/* Content */}
      <div className="p-4 space-y-3">
        {/* Title */}
        <Skeleton className="h-6 w-3/4" />
        
        {/* Meta info */}
        <div className="flex gap-2">
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="h-4 w-20" />
        </div>
        
        {/* Price */}
        <Skeleton className="h-8 w-32" />
        
        {/* Location */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
    </div>
  );
}

// Listing Grid Skeleton
export function ListingGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <ListingCardSkeleton key={i} />
      ))}
    </div>
  );
}

// Listing Table Skeleton
export function ListingTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="px-6 py-3 text-left">
              <Skeleton className="h-4 w-12" />
            </th>
            <th className="px-6 py-3 text-left">
              <Skeleton className="h-4 w-24" />
            </th>
            <th className="px-6 py-3 text-left">
              <Skeleton className="h-4 w-16" />
            </th>
            <th className="px-6 py-3 text-left">
              <Skeleton className="h-4 w-16" />
            </th>
            <th className="px-6 py-3 text-left">
              <Skeleton className="h-4 w-16" />
            </th>
            <th className="px-6 py-3 text-left">
              <Skeleton className="h-4 w-20" />
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="px-6 py-4">
                <Skeleton className="h-4 w-4 rounded" />
              </td>
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <Skeleton className="w-16 h-16 rounded-lg" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                </div>
              </td>
              <td className="px-6 py-4">
                <Skeleton className="h-4 w-20" />
              </td>
              <td className="px-6 py-4">
                <Skeleton className="h-6 w-16 rounded-full" />
              </td>
              <td className="px-6 py-4">
                <Skeleton className="h-4 w-12" />
              </td>
              <td className="px-6 py-4">
                <div className="flex gap-2">
                  <Skeleton className="h-8 w-8 rounded" />
                  <Skeleton className="h-8 w-8 rounded" />
                  <Skeleton className="h-8 w-8 rounded" />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Listing Detail Page Skeleton
export function ListingDetailSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Image Gallery */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <Skeleton className="w-full aspect-video" />
              <div className="p-4 flex gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="w-20 h-20 rounded-lg" />
                ))}
              </div>
            </div>

            {/* Title & Price */}
            <div className="bg-white rounded-xl shadow-lg p-6 space-y-4">
              <Skeleton className="h-8 w-3/4" />
              <Skeleton className="h-10 w-48" />
              <div className="flex gap-4">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-24" />
              </div>
            </div>

            {/* Specs */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <Skeleton className="h-7 w-40 mb-4" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="text-center p-4 bg-gray-50 rounded-lg space-y-2">
                    <Skeleton className="h-6 w-6 mx-auto rounded-full" />
                    <Skeleton className="h-4 w-16 mx-auto" />
                    <Skeleton className="h-5 w-12 mx-auto" />
                  </div>
                ))}
              </div>
            </div>

            {/* Description */}
            <div className="bg-white rounded-xl shadow-lg p-6 space-y-3">
              <Skeleton className="h-7 w-32 mb-4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Action Buttons */}
            <div className="bg-white rounded-xl shadow-lg p-6 space-y-3">
              <Skeleton className="h-12 w-full rounded-lg" />
              <div className="grid grid-cols-2 gap-3">
                <Skeleton className="h-10 rounded-lg" />
                <Skeleton className="h-10 rounded-lg" />
              </div>
            </div>

            {/* Dealer Info */}
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6">
                <div className="flex items-center gap-4">
                  <Skeleton className="w-16 h-16 rounded-lg bg-white/20" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-5 w-32 bg-white/20" />
                    <Skeleton className="h-4 w-24 bg-white/20" />
                  </div>
                </div>
              </div>
              <div className="p-6 space-y-3">
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            </div>

            {/* Stats */}
            <div className="bg-white rounded-xl shadow-lg p-6 text-center space-y-2">
              <Skeleton className="h-10 w-20 mx-auto" />
              <Skeleton className="h-4 w-24 mx-auto" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Dashboard Stats Skeleton
export function DashboardStatsSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-3 w-32" />
        </div>
      ))}
    </div>
  );
}

// Profile Skeleton
export function ProfileSkeleton() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// Notifications Skeleton
export function NotificationsSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-start gap-4">
            <Skeleton className="w-10 h-10 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-24" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="w-8 h-8 rounded" />
              <Skeleton className="w-8 h-8 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Analytics Chart Skeleton
export function AnalyticsChartSkeleton() {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <Skeleton className="h-6 w-48 mb-6" />
      <div className="space-y-4">
        <div className="flex items-end justify-between h-64 gap-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton 
              key={i} 
              className="w-full rounded-t-lg" 
              style={{ height: `${Math.random() * 60 + 40}%` }}
            />
          ))}
        </div>
        <div className="flex justify-between pt-4 border-t">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-12" />
          ))}
        </div>
      </div>
    </div>
  );
}

// Search Results Skeleton
export function SearchResultsSkeleton() {
  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex gap-4 overflow-x-auto">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-32 rounded-lg flex-shrink-0" />
        ))}
      </div>

      {/* Results Count */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-10 w-32 rounded-lg" />
      </div>

      {/* Results Grid */}
      <ListingGridSkeleton count={9} />
    </div>
  );
}

// Messages List Skeleton
export function MessagesListSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 divide-y divide-gray-200">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-4 hover:bg-gray-50">
          <div className="flex items-start gap-4">
            <Skeleton className="w-12 h-12 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-4 w-16" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Add shimmer animation to global CSS
export const shimmerStyles = `
  @keyframes shimmer {
    0% {
      background-position: -200% 0;
    }
    100% {
      background-position: 200% 0;
    }
  }
`;

// Full Page Loading Overlay
export function FullPageLoader({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="text-center space-y-4">
        <div className="relative w-16 h-16 mx-auto">
          <div className="absolute inset-0 border-4 border-blue-200 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-transparent animate-spin"></div>
        </div>
        <p className="text-gray-600 font-medium">{message}</p>
      </div>
    </div>
  );
}

// Button Loading State
export function ButtonLoader() {
  return (
    <div className="inline-flex items-center gap-2">
      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
      <span>Loading...</span>
    </div>
  );
}