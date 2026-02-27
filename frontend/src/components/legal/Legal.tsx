import React, { useState } from 'react';
import { Check, Download, FileText, Shield, Cookie } from 'lucide-react';

// ============================================
// COOKIE CONSENT BANNER
// ============================================

export const CookieConsent = () => {
  const [isVisible, setIsVisible] = useState(() => {
    return !localStorage.getItem('cookieConsent');
  });
  const [preferences, setPreferences] = useState({
    necessary: true,
    analytics: false,
    marketing: false
  });
  const [showDetails, setShowDetails] = useState(false);

  const handleAcceptAll = () => {
    const consent = { necessary: true, analytics: true, marketing: true };
    localStorage.setItem('cookieConsent', JSON.stringify(consent));
    setIsVisible(false);
    // Initialize analytics/marketing scripts here
  };

  const handleAcceptSelected = () => {
    localStorage.setItem('cookieConsent', JSON.stringify(preferences));
    setIsVisible(false);
    // Initialize only selected scripts
  };

  const handleRejectAll = () => {
    const consent = { necessary: true, analytics: false, marketing: false };
    localStorage.setItem('cookieConsent', JSON.stringify(consent));
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-blue-600 shadow-2xl z-50 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-start gap-4">
          <Cookie className="h-6 w-6 text-blue-600 flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-2">Cookie Preferences</h3>
            <p className="text-gray-600 mb-4">
              We use cookies to improve your experience, analyze site traffic, and personalize content.
              {' '}
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-blue-600 underline hover:text-blue-700"
              >
                {showDetails ? 'Hide details' : 'Learn more'}
              </button>
            </p>

            {showDetails && (
              <div className="mb-4 space-y-3 p-4 bg-gray-50 rounded-md">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={preferences.necessary}
                    disabled
                    className="mt-1"
                  />
                  <div>
                    <p className="font-semibold">Necessary Cookies (Required)</p>
                    <p className="text-sm text-gray-600">
                      Essential for the website to function properly. Cannot be disabled.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={preferences.analytics}
                    onChange={(e) => setPreferences({...preferences, analytics: e.target.checked})}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-semibold">Analytics Cookies</p>
                    <p className="text-sm text-gray-600">
                      Help us understand how visitors interact with our website.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={preferences.marketing}
                    onChange={(e) => setPreferences({...preferences, marketing: e.target.checked})}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-semibold">Marketing Cookies</p>
                    <p className="text-sm text-gray-600">
                      Used to deliver personalized advertisements relevant to you.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleAcceptAll}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
              >
                Accept All
              </button>
              <button
                onClick={handleAcceptSelected}
                className="px-6 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition"
              >
                Accept Selected
              </button>
              <button
                onClick={handleRejectAll}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition"
              >
                Reject All
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// GDPR DATA EXPORT REQUEST
// ============================================

export const DataExportRequest = () => {
  const [isRequesting, setIsRequesting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleExport = async () => {
    setIsRequesting(true);
    try {
      const response = await fetch('/api/gdpr/export-data', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'my-data-export.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setSuccess(true);
      }
    } catch (error) {
      console.error('Export failed:', error);
      alert('Failed to export data. Please try again.');
    } finally {
      setIsRequesting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <div className="flex items-center gap-3 mb-4">
        <Download className="h-6 w-6 text-blue-600" />
        <h2 className="text-xl font-semibold">Export Your Data</h2>
      </div>
      
      <p className="text-gray-600 mb-6">
        Under GDPR regulations, you have the right to receive a copy of all personal data we hold about you.
        Click below to download your data in JSON format.
      </p>

      {success ? (
        <div className="flex items-center gap-2 p-4 bg-green-50 text-green-800 rounded-md">
          <Check className="h-5 w-5" />
          <span>Data exported successfully!</span>
        </div>
      ) : (
        <button
          onClick={handleExport}
          disabled={isRequesting}
          className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition flex items-center gap-2"
        >
          <Download className="h-5 w-5" />
          {isRequesting ? 'Exporting...' : 'Export My Data'}
        </button>
      )}
    </div>
  );
};

// ============================================
// ACCOUNT DELETION REQUEST
// ============================================

export const AccountDeletion = () => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const handleDelete = async () => {
    if (confirmText !== 'DELETE') {
      alert('Please type DELETE to confirm');
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch('/api/gdpr/delete-account', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        alert('Your account has been scheduled for deletion. You will receive a confirmation email.');
        localStorage.removeItem('token');
        window.location.href = '/';
      }
    } catch (error) {
      console.error('Deletion failed:', error);
      alert('Failed to delete account. Please contact support.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="bg-red-50 border border-red-200 rounded-lg p-6">
      <h2 className="text-xl font-semibold text-red-900 mb-4">Delete Account</h2>
      
      <p className="text-red-800 mb-4">
        This will permanently delete your account and all associated data. This action cannot be undone.
      </p>

      {!showConfirm ? (
        <button
          onClick={() => setShowConfirm(true)}
          className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition"
        >
          Request Account Deletion
        </button>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">
              Type <strong>DELETE</strong> to confirm:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full px-4 py-2 border border-red-300 rounded-md focus:ring-2 focus:ring-red-500"
              placeholder="DELETE"
            />
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={handleDelete}
              disabled={isDeleting || confirmText !== 'DELETE'}
              className="px-6 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 transition"
            >
              {isDeleting ? 'Deleting...' : 'Confirm Deletion'}
            </button>
            <button
              onClick={() => {
                setShowConfirm(false);
                setConfirmText('');
              }}
              className="px-6 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================
// LEGAL PAGES LINKS (for Footer)
// ============================================

export const LegalLinks = () => {
  return (
    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
      <a href="/terms" className="hover:text-blue-600 transition">
        Terms of Service
      </a>
      <span>•</span>
      <a href="/privacy" className="hover:text-blue-600 transition">
        Privacy Policy
      </a>
      <span>•</span>
      <a href="/cookies" className="hover:text-blue-600 transition">
        Cookie Policy
      </a>
      <span>•</span>
      <a href="/dmca" className="hover:text-blue-600 transition">
        DMCA Policy
      </a>
    </div>
  );
};

// ============================================
// DEMO PAGE
// ============================================

const LegalDemo = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Cookie Consent Banner */}
      <CookieConsent />

      <div className="max-w-4xl mx-auto p-8 space-y-8">
        <h1 className="text-3xl font-bold">Legal & GDPR Compliance</h1>

        {/* Data Export */}
        <DataExportRequest />

        {/* Account Deletion */}
        <AccountDeletion />

        {/* Legal Links */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-semibold mb-4">Legal Pages</h2>
          <p className="text-gray-600 mb-4">
            These pages should be created with your actual legal content:
          </p>
          <LegalLinks />
        </div>

        {/* Backend Endpoints Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-blue-900 mb-4">
            Backend Implementation Required
          </h2>
          <div className="space-y-2 text-sm">
            <p className="font-mono">POST /api/gdpr/export-data</p>
            <p className="font-mono">DELETE /api/gdpr/delete-account</p>
            <p className="text-gray-700 mt-4">
              See the backend implementation in the next artifact...
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LegalDemo;
