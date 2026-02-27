'use client';

import { useState, useEffect } from 'react';
import { Shield, Key, CheckCircle, XCircle, Copy } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

export default function SecuritySettingsPage() {
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);

  useEffect(() => {
    fetchSecurityStatus();
  }, []);

  const fetchSecurityStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/auth/2fa/status'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setTwoFAEnabled(data.enabled);
      }
    } catch (error) {
      console.error('Failed to fetch security status:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggle2FA = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/auth/2fa/setup'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ enabled: !twoFAEnabled })
      });

      if (response.ok) {
        const data = await response.json();
        setTwoFAEnabled(data.enabled);
        
        if (data.enabled && data.backup_codes) {
          setBackupCodes(data.backup_codes);
          setShowBackupCodes(true);
        }
        
        alert(data.enabled ? '2FA enabled successfully!' : '2FA disabled');
      } else {
        alert('Failed to update 2FA settings');
      }
    } catch (error) {
      console.error('Failed to toggle 2FA:', error);
      alert('An error occurred');
    }
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join('\n'));
    alert('Backup codes copied to clipboard!');
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-secondary mb-2">Security Settings</h1>
        <p className="text-dark/70">Manage your account security and authentication methods</p>
      </div>

      {/* Two-Factor Authentication */}
      <div className="bg-white rounded-xl shadow-md p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Shield className="text-primary" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-secondary mb-2">
                Two-Factor Authentication
              </h2>
              <p className="text-dark/70 mb-4">
                Add an extra layer of security to your account. When enabled, you'll need to enter 
                a verification code sent to your email in addition to your password.
              </p>
              
              <div className="flex items-center gap-2 mb-4">
                {twoFAEnabled ? (
                  <>
                    <CheckCircle className="text-green-600" size={20} />
                    <span className="text-green-600 font-medium">Enabled</span>
                  </>
                ) : (
                  <>
                    <XCircle className="text-dark/70" size={20} />
                    <span className="text-dark/70">Disabled</span>
                  </>
                )}
              </div>

              <button
                onClick={toggle2FA}
                className={`px-6 py-2 rounded-lg font-medium ${
                  twoFAEnabled
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-primary hover:bg-primary/90 text-white'
                }`}
              >
                {twoFAEnabled ? 'Disable 2FA' : 'Enable 2FA'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Backup Codes Modal */}
      {showBackupCodes && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-8">
            <div className="text-center mb-6">
              <Key className="mx-auto mb-4 text-primary" size={48} />
              <h3 className="text-2xl font-bold text-secondary mb-2">
                Save Your Backup Codes
              </h3>
              <p className="text-dark/70">
                Store these codes in a safe place. You can use them to access your account 
                if you lose access to your email.
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="grid grid-cols-2 gap-3">
                {backupCodes.map((code, index) => (
                  <div
                    key={index}
                    className="bg-white px-4 py-2 rounded border border-gray-200 text-center font-mono text-sm"
                  >
                    {code}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={copyBackupCodes}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center justify-center gap-2"
              >
                <Copy size={16} />
                Copy Codes
              </button>
              <button
                onClick={() => setShowBackupCodes(false)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                I've Saved Them
              </button>
            </div>

            <p className="text-xs text-gray-500 text-center mt-4">
              ⚠️ These codes will only be shown once. Make sure to save them securely.
            </p>
          </div>
        </div>
      )}

      {/* Password Management */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-primary/10 rounded-lg">
            <Key className="text-primary" size={24} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-secondary mb-2">
              Password
            </h2>
            <p className="text-dark/70 mb-4">
              Change your password regularly to keep your account secure.
            </p>
            <button className="px-6 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg font-medium">
              Change Password
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}