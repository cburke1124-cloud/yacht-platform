"use client"

import { useState, useEffect } from 'react';
import { Cookie, X, Settings, Check } from 'lucide-react';

export default function CookieConsentBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [preferences, setPreferences] = useState({
    essential: true, // Always required
    analytics: false,
    marketing: false
  });

  useEffect(() => {
    // Check if user has already made a choice
    const consent = localStorage.getItem('cookie_consent');
    if (!consent) {
      // Show banner after a short delay
      setTimeout(() => setShowBanner(true), 1000);
    } else {
      // Load saved preferences
      try {
        const saved = JSON.parse(consent);
        setPreferences(saved);
      } catch (e) {
        console.error('Failed to parse cookie consent');
      }
    }
  }, []);

  const savePreferences = (prefs: typeof preferences) => {
    localStorage.setItem('cookie_consent', JSON.stringify(prefs));
    localStorage.setItem('cookie_consent_date', new Date().toISOString());
    setShowBanner(false);
    setShowSettings(false);
    
    // Here you would initialize analytics/marketing scripts based on preferences
    if (prefs.analytics) {
      // Initialize analytics (Google Analytics, etc.)
      console.log('Analytics enabled');
    }
    if (prefs.marketing) {
      // Initialize marketing pixels (Facebook Pixel, etc.)
      console.log('Marketing enabled');
    }
  };

  const acceptAll = () => {
    const allAccepted = {
      essential: true,
      analytics: true,
      marketing: true
    };
    savePreferences(allAccepted);
  };

  const acceptEssential = () => {
    savePreferences({
      essential: true,
      analytics: false,
      marketing: false
    });
  };

  const saveCustom = () => {
    savePreferences(preferences);
  };

  if (!showBanner) return null;

  return (
    <>
      {/* Main Banner */}
      {!showSettings && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t-2 border-primary/20 shadow-2xl animate-slide-up">
          <div className="max-w-7xl mx-auto">
            <div className="flex items-start gap-4">
              {/* Cookie Icon */}
              <div className="flex-shrink-0 w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                <Cookie className="text-primary" size={24} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-secondary mb-2">
                  We Value Your Privacy
                </h3>
                <p className="text-sm text-secondary/70 mb-4">
                  We use cookies to enhance your browsing experience, serve personalized content, and analyze our traffic. 
                  By clicking "Accept All", you consent to our use of cookies.
                  {' '}
                  <a href="/cookies" className="text-primary hover:underline">
                    Learn more
                  </a>
                </p>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={acceptAll}
                    className="px-6 py-2 bg-primary text-light rounded-lg hover-primary font-medium transition-colors"
                  >
                    Accept All
                  </button>
                  <button
                    onClick={acceptEssential}
                    className="px-6 py-2 border-2 border-primary/50 text-primary rounded-lg hover:bg-primary/5 font-medium transition-colors"
                  >
                    Essential Only
                  </button>
                  <button
                    onClick={() => setShowSettings(true)}
                    className="px-6 py-2 border-2 border-primary/50 text-primary rounded-lg hover:bg-primary/5 font-medium transition-colors flex items-center gap-2"
                  >
                    <Settings size={18} />
                    Customize
                  </button>
                </div>
              </div>

              {/* Close Button */}
              <button
                onClick={acceptEssential}
                className="flex-shrink-0 p-2 text-secondary/40 hover:text-secondary/60 rounded-lg hover:bg-secondary/5 transition-colors"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 flex items-center justify-center p-4 bg-black bg-opacity-50 animate-fade-in" style={{ zIndex: 9999 }}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-primary/20 p-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-secondary flex items-center gap-2">
                  <Cookie className="text-primary" size={28} />
                  Cookie Preferences
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Choose which cookies you want to allow
                </p>
              </div>
              <button
                onClick={() => setShowSettings(false)}
                className="p-2 text-secondary/40 hover:text-secondary/60 rounded-lg hover:bg-secondary/5"
              >
                <X size={24} />
              </button>
            </div>

            {/* Cookie Categories */}
            <div className="p-6 space-y-4">
              {/* Essential Cookies */}
              <div className="border border-primary/20 rounded-lg p-4 bg-primary/5">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-bold text-secondary flex items-center gap-2">
                      <Check className="text-primary" size={20} />
                      Essential Cookies
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Required for the website to function properly. These cannot be disabled.
                    </p>
                  </div>
                  <div className="ml-4">
                    <div className="w-12 h-6 bg-primary rounded-full flex items-center justify-end px-1 cursor-not-allowed opacity-75">
                      <div className="w-4 h-4 bg-light rounded-full"></div>
                    </div>
                  </div>
                </div>
                <ul className="text-sm text-secondary/70 mt-3 space-y-1">
                  <li>• Authentication & security</li>
                  <li>• Shopping cart functionality</li>
                  <li>• Basic site preferences</li>
                </ul>
              </div>

              {/* Analytics Cookies */}
              <div className="border border-primary/20 rounded-lg p-4 hover:border-primary/40 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-bold text-secondary">Analytics Cookies</h3>
                    <p className="text-sm text-secondary/70 mt-1">
                      Help us understand how visitors use our website to improve user experience.
                    </p>
                  </div>
                  <div className="ml-4">
                    <button
                      onClick={() => setPreferences({ ...preferences, analytics: !preferences.analytics })}
                      className={`w-12 h-6 rounded-full flex items-center transition-all ${
                        preferences.analytics 
                          ? 'bg-primary justify-end' 
                          : 'bg-secondary/30 justify-start'
                      } px-1`}
                    >
                      <div className="w-4 h-4 bg-light rounded-full"></div>
                    </button>
                  </div>
                </div>
                <ul className="text-sm text-gray-600 mt-3 space-y-1">
                  <li>• Page views and traffic analysis</li>
                  <li>• User behavior patterns</li>
                  <li>• Performance monitoring</li>
                </ul>
              </div>

              {/* Marketing Cookies */}
              <div className="border border-primary/20 rounded-lg p-4 hover:border-primary/40 transition-colors">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h3 className="font-bold text-secondary">Marketing Cookies</h3>
                    <p className="text-sm text-secondary/70 mt-1">
                      Used to show you personalized advertisements and track ad campaign performance.
                    </p>
                  </div>
                  <div className="ml-4">
                    <button
                      onClick={() => setPreferences({ ...preferences, marketing: !preferences.marketing })}
                      className={`w-12 h-6 rounded-full flex items-center transition-all ${
                        preferences.marketing 
                          ? 'bg-primary justify-end' 
                          : 'bg-secondary/30 justify-start'
                      } px-1`}
                    >
                      <div className="w-4 h-4 bg-light rounded-full"></div>
                    </button>
                  </div>
                </div>
                <ul className="text-sm text-gray-600 mt-3 space-y-1">
                  <li>• Targeted advertising</li>
                  <li>• Social media integration</li>
                  <li>• Conversion tracking</li>
                </ul>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="sticky bottom-0 bg-soft border-t border-primary/20 p-6">
              <div className="flex gap-3">
                <button
                  onClick={acceptEssential}
                  className="flex-1 px-6 py-3 border-2 border-primary/50 text-primary rounded-lg hover:bg-primary/5 font-medium transition-colors"
                >
                  Essential Only
                </button>
                <button
                  onClick={saveCustom}
                  className="flex-1 px-6 py-3 bg-primary text-light rounded-lg hover-primary font-medium transition-colors"
                >
                  Save Preferences
                </button>
                <button
                  onClick={acceptAll}
                  className="flex-1 px-6 py-3 bg-primary text-light rounded-lg hover-primary font-medium transition-colors"
                >
                  Accept All
                </button>
              </div>
              <p className="text-xs text-secondary/50 text-center mt-3">
                You can change your preferences anytime in settings
              </p>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        @keyframes fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
      `}</style>
    </>
  );
}
