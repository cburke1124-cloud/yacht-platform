'use client';

import Head from 'next/head';
import React from 'react';

// ============================================
// TYPE DEFINITIONS
// ============================================

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: string;
  author?: string;
  publishedTime?: string;
  modifiedTime?: string;
  structuredData?: Record<string, any>;
}

interface Listing {
  id: number;
  title: string;
  make?: string;
  model?: string;
  year?: number;
  price?: number;
  currency?: string;
  length_feet?: number;
  boat_type?: string;
  description?: string;
  condition?: string;
  city?: string;
  state?: string;
  images?: Array<{ url: string }>;
  created_at?: string;
  updated_at?: string;
}

interface Dealer {
  slug: string;
  company_name?: string;
  name: string;
  about_section?: string;
  logo_url?: string;
  banner_image?: string;
  address?: string;
  city?: string;
  state?: string;
  zip_code?: string;
  country?: string;
  phone?: string;
  email?: string;
  avg_rating?: number;
  reviews_count?: number;
}

interface SearchFilters {
  boat_type?: string;
  location?: string;
  [key: string]: any;
}

// ============================================
// BASE SEO COMPONENT
// ============================================

export const SEO: React.FC<SEOProps> = ({
  title = 'YachtVersal - Premium Yacht Marketplace',
  description = 'Find and sell luxury yachts worldwide. Browse thousands of yacht listings from trusted dealers.',
  keywords = 'yacht, boat, marine, luxury yacht, yacht for sale, boat dealers',
  image = '/og-image.jpg',
  url = '/',
  type = 'website',
  author = 'YachtVersal',
  publishedTime,
  modifiedTime,
  structuredData,
}) => {
  const siteUrl = 'https://yachtversal.com';
  const fullUrl = url.startsWith('http') ? url : `${siteUrl}${url}`;
  const fullImage = image.startsWith('http') ? image : `${siteUrl}${image}`;

  return (
    <Head>
      {/* Basic Meta */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="author" content={author} />
      <link rel="canonical" href={fullUrl} />

      {/* Open Graph */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={fullImage} />
      <meta property="og:site_name" content="YachtVersal" />

      {publishedTime && (
        <meta property="article:published_time" content={publishedTime} />
      )}
      {modifiedTime && (
        <meta property="article:modified_time" content={modifiedTime} />
      )}

      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={fullImage} />

      {/* Structured Data */}
      {structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData),
          }}
        />
      )}
    </Head>
  );
};

// ============================================
// LISTING PAGE SEO
// ============================================

export const ListingSEO: React.FC<{ listing: Listing }> = ({ listing }) => {
  const title = `${listing.year || ''} ${listing.make || ''} ${listing.model || ''} - ${listing.title}`.trim();

  const description =
    listing.description?.slice(0, 160) ||
    `${listing.length_feet}ft ${listing.boat_type || 'yacht'} for sale. Located in ${listing.city}, ${listing.state}.`;

  const image = listing.images?.[0]?.url || '/default-yacht.jpg';
  const url = `/listings/${listing.id}`;

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: title,
    image,
    description,
    brand: {
      '@type': 'Brand',
      name: listing.make || 'Unknown',
    },
    offers: {
      '@type': 'Offer',
      url: `https://yachtversal.com${url}`,
      priceCurrency: listing.currency || 'USD',
      price: listing.price,
      availability: 'https://schema.org/InStock',
      seller: {
        '@type': 'Organization',
        name: 'YachtVersal',
      },
    },
  };

  return (
    <SEO
      title={title}
      description={description}
      image={image}
      url={url}
      type="product"
      structuredData={structuredData}
      publishedTime={listing.created_at}
      modifiedTime={listing.updated_at}
    />
  );
};

// ============================================
// DEALER PAGE SEO
// ============================================

export const DealerSEO: React.FC<{ dealer: Dealer }> = ({ dealer }) => {
  const title = `${dealer.company_name || dealer.name} - YachtVersal Dealer`;

  const description =
    dealer.about_section?.slice(0, 160) ||
    `${dealer.company_name || dealer.name} is a trusted yacht dealer on YachtVersal.`;

  const structuredData = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: dealer.company_name || dealer.name,
    image: dealer.logo_url || dealer.banner_image,
    address: {
      '@type': 'PostalAddress',
      addressLocality: dealer.city,
      addressRegion: dealer.state,
      postalCode: dealer.zip_code,
      addressCountry: dealer.country,
    },
    telephone: dealer.phone,
    email: dealer.email,
    url: `https://yachtversal.com/dealers/${dealer.slug}`,
  };

  return (
    <SEO
      title={title}
      description={description}
      image={dealer.logo_url || dealer.banner_image}
      url={`/dealers/${dealer.slug}`}
      type="profile"
      structuredData={structuredData}
    />
  );
};

// ============================================
// SEARCH PAGE SEO
// ============================================

export const SearchSEO: React.FC<{ filters: SearchFilters }> = ({ filters }) => {
  let title = 'Search Yachts - YachtVersal';
  let description = 'Search and filter thousands of yacht listings';

  if (filters.boat_type) {
    title = `${filters.boat_type} Yachts for Sale - YachtVersal`;
  }

  if (filters.location) {
    title = `Yachts for Sale in ${filters.location} - YachtVersal`;
  }

  return <SEO title={title} description={description} />;
};

export default SEO;