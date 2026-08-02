'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { AlertCircle, Loader2 } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';
import PhoneInput from '@/app/components/PhoneInput';

export default function FoundingBrokerPage() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [website, setWebsite] = useState('');
  const [phone, setPhone] = useState('');
  const [yearsExperience, setYearsExperience] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !companyName.trim()) {
      setError('Please fill in your name, email, and company name.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(apiUrl('/founding-broker'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          company_name: companyName.trim(),
          website: website.trim() || null,
          phone: phone.trim() || null,
          years_experience: yearsExperience || null,
          message: message.trim() || null,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        router.push('/founding-broker/thank-you');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Hero */}
      <div className="relative bg-[#10214F] text-white overflow-hidden">
        {/* Watermark behind hero text */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none" aria-hidden="true">
          <Image
            src="/logo/footer-watermark.png"
            alt=""
            width={574}
            height={574}
            className=""
          />
        </div>
        <div className="relative max-w-6xl mx-auto px-6 py-20 text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
            Join the YachtVersal
            <br />
            <span className="text-[#01BBDC]">Founding Broker Program</span>
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Be among the first brokers on the platform. Get free access for life, priority support, and a head start reaching thousands of motivated buyers.
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="relative max-w-2xl mx-auto px-6 py-16 overflow-hidden">
        <div className="text-center mb-10">
          <p className="inline-block text-sm font-bold uppercase tracking-widest text-white bg-[#01BBDC] px-4 py-1.5 rounded-full mb-4">Free Listings for Life</p>
          <h2 className="text-3xl font-bold text-[#10214F] mb-3">Sign Up Now</h2>
          <p className="text-gray-500">
            Fill out the form below and a YachtVersal representative will be in touch to get you started.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Name + Email */}
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-semibold text-[#10214F] mb-1.5">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Jane Smith"
                required
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#01BBDC] transition-colors text-[#2E2E2E] placeholder-gray-400"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#10214F] mb-1.5">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="jane@brokerage.com"
                required
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#01BBDC] transition-colors text-[#2E2E2E] placeholder-gray-400"
              />
            </div>
          </div>

          {/* Company + Website */}
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-semibold text-[#10214F] mb-1.5">
                Company Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                placeholder="Blue Water Yachts"
                required
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#01BBDC] transition-colors text-[#2E2E2E] placeholder-gray-400"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#10214F] mb-1.5">
                Company Website
              </label>
              <input
                type="url"
                value={website}
                onChange={e => setWebsite(e.target.value)}
                placeholder="https://yourbrokerage.com"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#01BBDC] transition-colors text-[#2E2E2E] placeholder-gray-400"
              />
            </div>
          </div>

          {/* Phone + Years */}
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-semibold text-[#10214F] mb-1.5">
                Phone Number
              </label>
              <PhoneInput
                value={phone}
                onChange={value => setPhone(value)}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#10214F] mb-1.5">
                Number of Listings
              </label>
              <select
                value={yearsExperience}
                onChange={e => setYearsExperience(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#01BBDC] transition-colors text-[#2E2E2E] bg-white"
              >
                <option value="">Select...</option>
                <option value="1–5 listings">1–5</option>
                <option value="6–15 listings">6–15</option>
                <option value="16–30 listings">16–30</option>
                <option value="31–50 listings">31–50</option>
                <option value="50+ listings">50+</option>
              </select>
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-semibold text-[#10214F] mb-1.5">
              Anything else you'd like us to know?
            </label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={4}
              placeholder="Tell us about your current listings, inventory focus, or any questions you have..."
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#01BBDC] transition-colors text-[#2E2E2E] placeholder-gray-400 resize-none"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm">
              <AlertCircle size={16} className="shrink-0" />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-[#01BBDC] hover:bg-[#00a5c4] disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold text-lg rounded-xl transition-all shadow-lg hover:shadow-xl"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="animate-spin h-5 w-5" />
                Submitting...
              </span>
            ) : (
              'Sign up for Free'
            )}
          </button>

          <p className="text-center text-xs text-gray-400 mt-2">
            No credit card required. We'll reach out to set up your account manually.
          </p>
        </form>
      </div>
    </div>
  );
}
