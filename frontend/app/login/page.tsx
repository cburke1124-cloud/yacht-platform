'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiUrl } from '@/app/lib/apiRoot';
import TermsAcceptanceModal from '@/app/components/TermsAcceptanceModal';

export default function LoginPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [pendingRedirect, setPendingRedirect] = useState<string>('/dashboard');
  const [userName, setUserName] = useState<string | undefined>();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(apiUrl('/auth/login'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Login failed');
      }

      // Store token and notify Navbar immediately
      localStorage.setItem('token', data.access_token);
      window.dispatchEvent(new Event('authChange'));

      // Fetch user info to determine redirect and terms status
      const userResponse = await fetch(apiUrl('/auth/me'), {
        headers: {
          'Authorization': `Bearer ${data.access_token}`
        }
      });

      const userData = await userResponse.json();

      // Determine redirect target
      let redirectTo = '/dashboard';
      if (userData.user_type === 'admin') {
        redirectTo = '/admin';
      } else if (userData.user_type === 'salesman') {
        redirectTo = '/sales-rep/dashboard';
      } else if (userData.user_type === 'user') {
        redirectTo = '/account';
      }

      // Check if terms acceptance is needed (skip for admins)
      if (userData.user_type !== 'admin' && !userData.agreed_terms) {
        setUserName(userData.first_name || undefined);
        setPendingRedirect(redirectTo);
        setShowTermsModal(true);
        return;
      }

      router.push(redirectTo);
    } catch (err: any) {
      setError(err.message || 'Failed to login. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTermsAccepted = () => {
    setShowTermsModal(false);
    router.push(pendingRedirect);
  };

  const handleTermsDecline = () => {
    setShowTermsModal(false);
    localStorage.removeItem('token');
    setError('You must accept the terms to continue.');
  };

  return (
    <>
      {showTermsModal && (
        <TermsAcceptanceModal
          onAccepted={handleTermsAccepted}
          onDecline={handleTermsDecline}
          userName={userName}
        />
      )}
    <div className="min-h-screen section-light flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        {/* Logo/Header */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-block">
            <h1 className="text-4xl font-bold text-primary mb-2">YachtVersal</h1>
          </Link>
          <h2 className="text-2xl font-semibold text-secondary">Welcome Back</h2>
          <p className="mt-2 text-dark/70">Sign in to your account</p>
        </div>

        {/* Login Form */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-dark mb-2">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-dark mb-2">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 text-primary focus:ring-primary border-gray-200 rounded"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-dark">
                  Remember me
                </label>
              </div>

              <div className="text-sm">
                <a href="#" className="font-medium text-primary hover:text-primary/80">
                  Forgot password?
                </a>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-dark/70">Don't have an account?</span>
              </div>
            </div>

            <div className="mt-6">
              <Link
                href="/register"
                className="w-full flex justify-center py-3 px-4 border border-gray-200 rounded-lg shadow-sm text-sm font-medium text-secondary bg-white hover:bg-gray-50"
              >
                Create an account
              </Link>
            </div>
          </div>
        </div>

        {/* Back to home */}
        <div className="text-center mt-6">
          <Link href="/" className="text-sm text-primary hover:text-primary/80">
            ← Back to home
          </Link>
        </div>
      </div>
    </div>
    </>
  );
}