'use client';

import { useState } from 'react';
import { Globe, AlertCircle, CheckCircle } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

export default function AdminScraperTab() {
  const [scraperTab, setScraperTab] = useState<'single' | 'broker'>('single');
  
  // Single URL scraping
  const [singleUrl, setSingleUrl] = useState('');
  const [singleLoading, setSingleLoading] = useState(false);
  const [singleResult, setSingleResult] = useState<any>(null);
  const [singleError, setSingleError] = useState('');
  
  // Broker scraping
  const [brokerUrl, setBrokerUrl] = useState('');
  const [brokerLoading, setBrokerLoading] = useState(false);
  const [brokerResult, setBrokerResult] = useState<any>(null);
  const [brokerError, setBrokerError] = useState('');

  const handleScrapeSingle = async () => {
    if (!singleUrl) {
      setSingleError('Please enter a URL');
      return;
    }

    setSingleLoading(true);
    setSingleError('');
    setSingleResult(null);

    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch(apiUrl('/scraper/single'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ url: singleUrl, user_id: 1 })
      });

      const data = await response.json();

      if (data.success) {
        setSingleResult(data.data);
      } else {
        setSingleError(data.error || data.message || 'Failed to scrape listing');
      }
    } catch (error: any) {
      setSingleError(error.message || 'Network error');
    } finally {
      setSingleLoading(false);
    }
  };

  const handleScrapeBroker = async () => {
    if (!brokerUrl) {
      setBrokerError('Please enter a broker URL');
      return;
    }

    setBrokerLoading(true);
    setBrokerError('');
    setBrokerResult(null);

    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch(apiUrl('/scraper/broker'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ broker_url: brokerUrl, user_id: 1 })
      });

      const data = await response.json();

      if (data.success) {
        setBrokerResult(data);
      } else {
        setBrokerError(data.message || 'Failed to scrape broker listings');
      }
    } catch (error: any) {
      setBrokerError(error.message || 'Network error');
    } finally {
      setBrokerLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="p-6 border-b">
        <div className="flex items-center gap-3">
          <Globe className="text-blue-600" size={32} />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Broker Listing Importer</h2>
            <p className="text-gray-600 text-sm">Import listings from partner broker websites (with permission)</p>
          </div>
        </div>
      </div>

      <div className="p-6">
        {/* Warning */}
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-900 font-medium">⚠️ Use Responsibly</p>
          <p className="text-xs text-yellow-800 mt-1">
            Only scrape from brokers who have given explicit permission in their contract. Respect robots.txt and rate limits.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex border-b mb-6">
          <button
            onClick={() => setScraperTab('single')}
            className={`px-6 py-3 font-medium transition-colors ${
              scraperTab === 'single'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Single Listing
          </button>
          <button
            onClick={() => setScraperTab('broker')}
            className={`px-6 py-3 font-medium transition-colors ${
              scraperTab === 'broker'
                ? 'border-b-2 border-blue-500 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Broker Inventory
          </button>
        </div>

        {/* Single Listing Tab */}
        {scraperTab === 'single' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Listing URL
            </label>
            <input
              type="url"
              value={singleUrl}
              onChange={(e) => setSingleUrl(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="https://broker-website.com/listings/yacht-123"
            />

            {singleError && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
                <p className="text-sm text-red-800">{singleError}</p>
              </div>
            )}

            {singleResult && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start gap-2 mb-2">
                  <CheckCircle className="text-green-600 flex-shrink-0" size={20} />
                  <p className="text-sm text-green-800 font-medium">Successfully scraped!</p>
                </div>
                <div className="text-sm text-green-800 space-y-1">
                  <p><strong>Title:</strong> {singleResult.title}</p>
                  <p><strong>Make/Model:</strong> {singleResult.make} {singleResult.model}</p>
                  <p><strong>Price:</strong> ${singleResult.price?.toLocaleString()}</p>
                  <p><strong>Location:</strong> {singleResult.city}, {singleResult.state}</p>
                </div>
              </div>
            )}

            <button
              onClick={handleScrapeSingle}
              disabled={singleLoading || !singleUrl}
              className="mt-6 w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
            >
              {singleLoading ? 'Scraping...' : '🔍 Scrape Single Listing'}
            </button>
          </div>
        )}

        {/* Broker Inventory Tab */}
        {scraperTab === 'broker' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Broker Inventory Page URL
            </label>
            <input
              type="url"
              value={brokerUrl}
              onChange={(e) => setBrokerUrl(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="https://broker-website.com/inventory"
            />
            <p className="text-sm text-gray-600 mt-2">
              📦 This will find all listing URLs on the page and import them as drafts
            </p>

            {brokerError && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="text-red-600 flex-shrink-0" size={20} />
                <p className="text-sm text-red-800">{brokerError}</p>
              </div>
            )}

            {brokerResult && (
              <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-start gap-2 mb-2">
                  <CheckCircle className="text-green-600 flex-shrink-0" size={20} />
                  <p className="text-sm text-green-800 font-medium">Scraping started!</p>
                </div>
                <p className="text-sm text-green-800">{brokerResult.message}</p>
              </div>
            )}

            <button
              onClick={handleScrapeBroker}
              disabled={brokerLoading || !brokerUrl}
              className="mt-6 w-full px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
            >
              {brokerLoading ? 'Scraping Inventory...' : '🚀 Import Broker Inventory'}
            </button>

            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900">
                <strong>Note:</strong> This process runs in the background and may take several minutes. 
                Check the listings tab to see imported drafts.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}