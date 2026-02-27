'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/+$/, '');
const API_ROOT = API_BASE.endsWith('/api') ? API_BASE : `${API_BASE}/api`;

interface ScraperModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataExtracted: (data: any) => void;
  userId: number;
}

export default function ScraperModal({ 
  isOpen, 
  onClose, 
  onDataExtracted, 
  userId 
}: ScraperModalProps) {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleParseText = async () => {
    if (!text) {
      setError('Please enter yacht description text');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const token = localStorage.getItem('token');
      
      const response = await fetch(`${API_ROOT}/scraper/parse-text`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({ 
          text, 
          user_id: userId 
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        onDataExtracted(data.data);
        onClose();
        setText('');
      } else {
        setError(data.message || 'Failed to parse text');
      }
    } catch (err) {
      setError('Network error. Make sure backend is running');
      console.error('Parsing error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-primary/20 flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-2xl font-bold text-dark">
            🤖 AI Listing Assistant
          </h2>
          <button
            onClick={onClose}
            className="text-secondary hover:text-secondary/70 transition-colors"
          >
            <X size={24} />
          </button>
        </div>
        
        <div className="p-6">
          {/* Instructions */}
          <div className="mb-6 p-4 bg-primary/10 border border-primary/30 rounded-lg">
            <p className="text-sm text-primary font-medium mb-2">
              ✨ How it works:
            </p>
            <ol className="text-sm text-primary/80 space-y-1 list-decimal list-inside">
              <li>Copy your yacht listing from YachtWorld, BoatTrader, or your website</li>
              <li>Paste the full description below</li>
              <li>Click "Extract Data" - AI will parse all specifications</li>
              <li>Review the extracted data and make any edits</li>
              <li>Upload photos and publish!</li>
            </ol>
          </div>

          {/* Error Display */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 flex items-start">
              <span className="text-red-500 mr-2">⚠️</span>
              <span>{error}</span>
            </div>
          )}
          
          {/* Text Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Paste Your Listing Description
            </label>
            <textarea
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
              rows={14}
              placeholder="Example:

2006 Yellowfin 36 Offshore

2023 Triple Yamaha 300s (55 Hours) with warranty
Includes Loadmaster Trailer 
New Fuel Tanks Installed by Yellowfin

Accessories:
- Dual Garmin 7615 GPS/Depthfinder
- Garmin Radar & Autopilot
- Fusion Sound System
- Electric Reel Outlets
- Underwater Lights

This 36' Yellowfin delivers the perfect combination of speed, 
performance, and offshore capability...

Price: $250,000
Located in Miami, Florida"
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={loading}
            />
            <p className="text-sm text-gray-600 mt-2">
              💡 Tip: Include as much detail as possible for better AI extraction
            </p>
          </div>
          
          <button
            className="mt-6 w-full px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-medium hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg"
            onClick={handleParseText}
            disabled={loading || !text}
          >
            {loading ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                AI is analyzing...
              </span>
            ) : (
              '✨ Extract Data with AI'
            )}
          </button>
        </div>
        
        {/* Footer */}
        <div className="p-6 border-t bg-gray-50 flex justify-between items-center">
          <p className="text-sm text-gray-600">
            💡 Review AI-extracted data carefully before publishing
          </p>
          <button
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}