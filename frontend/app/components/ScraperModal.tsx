'use client';

import { useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import { API_ROOT } from '@/app/lib/apiRoot';

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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
      <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" style={{ border: '1px solid rgba(0,0,0,0.08)' }}>

        {/* Header */}
        <div className="px-6 py-5 border-b flex items-center justify-between sticky top-0 bg-white rounded-t-2xl" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#01BBDC' }}>
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: '#10214F' }}>AI Listing Assistant</h2>
              <p className="text-xs" style={{ color: 'rgba(16,33,79,0.5)' }}>Paste a listing and auto-fill your form</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-5">

          {/* Instructions */}
          <div className="p-4 rounded-xl" style={{ background: 'rgba(1,187,220,0.06)', border: '1px solid rgba(1,187,220,0.2)' }}>
            <p className="text-sm font-semibold mb-2" style={{ color: '#10214F' }}>How it works</p>
            <ol className="text-sm space-y-1 list-decimal list-inside" style={{ color: 'rgba(16,33,79,0.7)' }}>
              <li>Copy a yacht listing from YachtWorld, BoatTrader, or your own website</li>
              <li>Paste the full description below</li>
              <li>Click <strong>Extract with AI</strong> — all specs are parsed automatically</li>
              <li>Review the pre-filled fields, make any edits, then publish</li>
            </ol>
          </div>

          {/* Error */}
          {error && (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Textarea */}
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: '#10214F' }}>
              Listing Description
            </label>
            <textarea
              className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#01BBDC] focus:border-transparent transition"
              rows={14}
              placeholder={`Example:\n\n2006 Yellowfin 36 Offshore\nTriple Yamaha 300s (55 Hours)\nIncludes Loadmaster Trailer\n\n- Dual Garmin 7615 GPS/Depthfinder\n- Garmin Radar & Autopilot\n- Underwater Lights\n\nPrice: $250,000\nLocated in Miami, Florida`}
              value={text}
              onChange={(e) => setText(e.target.value)}
              disabled={loading}
            />
            <p className="text-xs text-gray-400 mt-1.5">Include as much detail as possible for the best results.</p>
          </div>

          {/* Submit */}
          <button
            className="w-full px-6 py-3 rounded-xl text-white text-sm font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-opacity hover:opacity-90"
            style={{ background: '#01BBDC' }}
            onClick={handleParseText}
            disabled={loading || !text}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Analyzing…
              </span>
            ) : (
              'Extract with AI'
            )}
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-between items-center" style={{ borderColor: 'rgba(0,0,0,0.06)' }}>
          <p className="text-xs text-gray-400">Review all extracted data before publishing.</p>
          <button
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
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
