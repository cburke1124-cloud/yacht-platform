'use client';

import { Suspense, useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

interface InvitationData {
  email: string;
  company_name: string;
  first_name: string;
  last_name: string;
  expires_at: string;
}

function InvitedSignupContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');
  
  const [invitationData, setInvitationData] = useState<InvitationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });

  useEffect(() => {
    if (token) {
      validateInvitation();
    } else {
      setError('No invitation token provided');
      setLoading(false);
    }
  }, [token]);

  const validateInvitation = async () => {
    try {
      const response = await fetch(
        apiUrl(`/invitations/validate/${token}`)
      );
      
      if (response.ok) {
        const data = await response.json();
        setInvitationData(data);
      } else {
        setError('Invalid or expired invitation');
        setTimeout(() => router.push('/register'), 3000);
      }
    } catch (err) {
      setError('Failed to validate invitation');
      setTimeout(() => router.push('/register'), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const response = await fetch(apiUrl('/auth/register-invited'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invitation_token: token,
          password: formData.password
        })
      });

      if (response.ok) {
        const data = await response.json();
        localStorage.setItem('token', data.access_token);
        window.dispatchEvent(new Event('authChange'));
        router.push('/dashboard');
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Registration failed');
      }
    } catch (err) {
      setError('An error occurred during registration');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <InvitationLoading />;
  }

  if (error && !invitationData) {
    return (
      <div className="min-h-screen flex items-center justify-center section-light p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <AlertCircle className="mx-auto mb-4 text-red-600" size={48} />
          <h2 className="text-2xl font-bold text-secondary mb-2">Invalid Invitation</h2>
          <p className="text-dark/70 mb-6">{error}</p>
          <p className="text-sm text-dark/70">Redirecting to registration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center section-light p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <CheckCircle className="mx-auto mb-4 text-green-600" size={48} />
          <h1 className="text-3xl font-bold text-secondary mb-2">
            Welcome to YachtVersal!
          </h1>
          <p className="text-dark/70">
            Complete your registration to get started
          </p>
        </div>

        {invitationData && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-secondary mb-2">Your Information</h3>
            <div className="space-y-1 text-sm text-dark">
              <p><strong>Name:</strong> {invitationData.first_name} {invitationData.last_name}</p>
              <p><strong>Email:</strong> {invitationData.email}</p>
              <p><strong>Company:</strong> {invitationData.company_name}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-dark mb-2">
              Create Password *
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Min 8 characters"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-dark mb-2">
              Confirm Password *
            </label>
            <input
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="Confirm your password"
              required
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 bg-primary text-white rounded-lg hover:bg-primary/90 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="animate-spin" size={20} />
                Creating Account...
              </>
            ) : (
              'Complete Registration'
            )}
          </button>
        </form>

        <p className="text-center text-sm text-dark/70 mt-6">
          By completing registration, you agree to our Terms of Service and Privacy Policy
        </p>
      </div>
    </div>
  );
}

function InvitationLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center section-light">
      <div className="text-center">
        <Loader2 className="animate-spin mx-auto mb-4 text-primary" size={48} />
        <p className="text-dark/70">Validating invitation...</p>
      </div>
    </div>
  );
}

export default function InvitedSignupPage() {
  return (
    <Suspense fallback={<InvitationLoading />}>
      <InvitedSignupContent />
    </Suspense>
  );
}