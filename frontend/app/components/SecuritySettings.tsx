'use client';

import { useState, useEffect } from 'react';
import { Shield, Mail, CheckCircle, AlertCircle, Key, Copy, Check } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

export default function SecuritySettingsComponent() {
  const [user, setUser] = useState<any>(null);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [showBackupCodes, setShowBackupCodes] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  useEffect(() => {
    fetchUserInfo();
  }, []);

  const fetchUserInfo = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/auth/me'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setUser(data);
        setTwoFactorEnabled(data.two_factor_enabled || false);
        setEmailVerified(data.email_verified || false);
      }
    } catch (error) {
      console.error('Failed to fetch user info:', error);
    }
  };

  const handleToggle2FA = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/auth/2fa/enable'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ enabled: !twoFactorEnabled })
      });

      if (response.ok) {
        const data = await response.json();
        setTwoFactorEnabled(data.enabled);
        
        if (data.enabled && data.backup_codes) {
          setBackupCodes(data.backup_codes);
          setShowBackupCodes(true);
        }
        
        alert(data.enabled ? 
          '✅ Two-factor authentication enabled!' : 
          '✅ Two-factor authentication disabled'
        );
      }
    } catch (error) {
      console.error('Failed to toggle 2FA:', error);
      alert('Failed to update 2FA settings');
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(apiUrl('/auth/resend-verification'), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        setVerificationSent(true);
        setTimeout(() => setVerificationSent(false), 5000);
      }
    } catch (error) {
      console.error('Failed to resend verification:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const downloadBackupCodes = () => {
    const text = backupCodes.join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'yachtversal-backup-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Email Verification */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            emailVerified ? 'bg-green-100' : 'bg-yellow-100'
          }`}>
            {emailVerified ? (
              <CheckCircle className="text-green-600" size={24} />
            ) : (
              <AlertCircle className="text-yellow-600" size={24} />
            )}
          </div>

          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-1">Email Verification</h3>
            <p className="text-sm text-gray-600 mb-4">
              {emailVerified ? (
                <>✅ Your email <strong>{user?.email}</strong> is verified</>
              ) : (
                <>⚠️ Please verify your email address to secure your account</>
              )}
            </p>

            {!emailVerified && (
              <div>
                {verificationSent ? (
                  <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                    ✅ Verification email sent! Check your inbox.
                  </div>
                ) : (
                  <button
                    onClick={handleResendVerification}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {loading ? 'Sending...' : 'Resend Verification Email'}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Two-Factor Authentication */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
            twoFactorEnabled ? 'bg-green-100' : 'bg-gray-100'
          }`}>
            <Shield className={twoFactorEnabled ? 'text-green-600' : 'text-gray-600'} size={24} />
          </div>

          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-1">Two-Factor Authentication</h3>
            <p className="text-sm text-gray-600 mb-4">
              Add an extra layer of security to your account. When enabled, you'll receive a 
              verification code via email every time you sign in.
            </p>

            <div className="flex items-center gap-4 mb-4">
              <button
                onClick={handleToggle2FA}
                disabled={loading}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  twoFactorEnabled ? 'bg-green-600' : 'bg-gray-300'
                } disabled:opacity-50`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    twoFactorEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className="text-sm font-medium text-gray-700">
                {twoFactorEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>

            {twoFactorEnabled && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm">
                <p className="text-gray-700">
                  <strong>🔒 Active Protection:</strong> You'll receive a code via email each time you log in.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Backup Codes Modal/Section */}
      {showBackupCodes && backupCodes.length > 0 && (
        <div className="bg-white rounded-lg shadow-md p-6 border-2 border-yellow-300">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
              <Key className="text-yellow-600" size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-1">Backup Codes</h3>
              <p className="text-sm text-gray-600">
                Save these backup codes in a safe place. Each code can be used once if you can't access your email.
              </p>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="grid grid-cols-2 gap-3">
              {backupCodes.map((code, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-3"
                >
                  <span className="font-mono text-sm font-semibold">{code}</span>
                  <button
                    onClick={() => copyToClipboard(code)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    {copiedCode === code ? (
                      <Check className="text-green-600" size={18} />
                    ) : (
                      <Copy size={18} />
                    )}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={downloadBackupCodes}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Download Codes
            </button>
            <button
              onClick={() => setShowBackupCodes(false)}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              I've Saved Them
            </button>
          </div>

          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-gray-700">
            <strong>⚠️ Important:</strong> Store these codes securely. You won't be able to see them again!
          </div>
        </div>
      )}

      {/* Security Tips */}
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Shield className="text-blue-600" size={20} />
          Security Best Practices
        </h3>
        <ul className="space-y-2 text-sm text-gray-700">
          <li className="flex items-start gap-2">
            <span className="text-blue-600 mt-0.5">•</span>
            <span>Use a unique, strong password for your YachtVersal account</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 mt-0.5">•</span>
            <span>Enable two-factor authentication for maximum security</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 mt-0.5">•</span>
            <span>Review your activity log regularly for suspicious actions</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-blue-600 mt-0.5">•</span>
            <span>Never share your password or backup codes with anyone</span>
          </li>
        </ul>
      </div>
    </div>
  );
}