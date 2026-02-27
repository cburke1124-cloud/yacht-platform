'use client';

import { useState, useEffect } from 'react';
import { Globe, Plus, Settings, Activity, CheckCircle, XCircle, Clock } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

interface WordPressSite {
  id: number;
  site_name?: string;
  domain: string;
  status: 'active' | 'provisioning' | 'inactive';
  listings_count: number;
  last_sync?: string;
}

export default function WordPressSitesPage() {
  const [sites, setSites] = useState<WordPressSite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSites();
  }, []);

  const fetchSites = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/wordpress-sites'), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      setSites(data);
    } catch (error) {
      console.error('Failed to fetch WordPress sites:', error);
    } finally {
      setLoading(false);
    }
  };

  const syncSite = async (siteId: number) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl(`/wordpress-sites/${siteId}/sync`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sync_type: 'full' })
      });
      
      if (response.ok) {
        alert('Sync started successfully!');
        fetchSites();
      }
    } catch (error) {
      console.error('Sync failed:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">WordPress Sites</h1>
          <p className="text-gray-600 mt-1">Manage your connected WordPress sites</p>
        </div>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
          <Plus className="w-4 h-4" />
          Create Site
        </button>
      </div>

      {/* Sites Grid */}
      <div className="grid gap-6">
        {sites.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg">
            <Globe className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 mb-2">No WordPress sites yet</p>
            <p className="text-sm text-gray-400 mb-4">
              Connect your WordPress site to sync listings automatically
            </p>
            <button className="text-blue-600 hover:text-blue-800 font-medium transition-colors">
              Create your first site
            </button>
          </div>
        ) : (
          sites.map((site) => (
            <div 
              key={site.id} 
              className="bg-white border rounded-lg p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                {/* Site Info */}
                <div className="flex-1">
                  <h3 className="text-xl font-semibold mb-2">
                    {site.site_name || site.domain}
                  </h3>
                  <a 
                    href={`https://${site.domain}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline flex items-center gap-1 mb-4"
                  >
                    <Globe className="w-4 h-4" />
                    {site.domain}
                  </a>
                  
                  {/* Site Stats */}
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    {/* Status Badge */}
                    <span className={`px-3 py-1 rounded-full font-medium inline-flex items-center gap-1 ${
                      site.status === 'active' ? 'bg-green-100 text-green-800' :
                      site.status === 'provisioning' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {site.status === 'active' && <CheckCircle className="w-3 h-3" />}
                      {site.status === 'provisioning' && <Clock className="w-3 h-3" />}
                      {site.status === 'inactive' && <XCircle className="w-3 h-3" />}
                      {site.status.charAt(0).toUpperCase() + site.status.slice(1)}
                    </span>
                    
                    {/* Listings Count */}
                    <span className="text-gray-600">
                      {site.listings_count} listings
                    </span>
                    
                    {/* Last Sync */}
                    {site.last_sync && (
                      <span className="text-gray-500">
                        Last sync: {new Date(site.last_sync).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button 
                    onClick={() => syncSite(site.id)}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                    title="Sync now"
                  >
                    <Activity className="w-5 h-5" />
                  </button>
                  <button 
                    className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                    title="Settings"
                  >
                    <Settings className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}