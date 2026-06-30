/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    '/charter-destinations': ['./public/data/charter_destinations.json'],
    '/charter-destinations/[...slug]': ['./public/data/charter_destinations.json'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '8000',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'yacht-platform.onrender.com',
        pathname: '/**',
      },
      // Scraped listings pull images from dozens of external broker/CDN domains
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

module.exports = nextConfig;