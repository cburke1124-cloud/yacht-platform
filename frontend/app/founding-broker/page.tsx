'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Anchor, CheckCircle, AlertCircle, Loader2, Star, Users, TrendingUp, Globe } from 'lucide-react';
import { apiUrl } from '@/app/lib/apiRoot';

const PERKS = [
  { icon: Star, title: 'Free Subscription', desc: 'Full platform access at no cost as a founding member.' },
  { icon: Users, title: 'Priority Onboarding', desc: 'A dedicated representative to get your listings live fast.' },
  { icon: TrendingUp, title: 'Early Adopter Benefits', desc: 'Lock in exclusive rates and features before public launch.' },
  { icon: Globe, title: 'Global Buyer Reach', desc: 'Connect with high-net-worth buyers searching worldwide.' },
];

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
      <div className="bg-[#10214F] text-white">
        <div className="max-w-6xl mx-auto px-6 py-20 text-center">
          <div className="inline-flex items-center gap-2 bg-[#01BBDC]/20 border border-[#01BBDC]/40 text-[#01BBDC] text-sm font-semibold px-4 py-1.5 rounded-full mb-6">
            <Anchor size={14} />
            Limited Spots Available
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
            Join the YachtVersal
            <br />
            <span className="text-[#01BBDC]">Founding Broker Program</span>
          </h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Be among the first brokers on the platform. Get free access, priority support, and a head start reaching thousands of motivated buyers.
          </p>
        </div>
      </div>

      {/* Perks */}
      <div className="bg-[#F5F7FA] border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-14 grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {PERKS.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex flex-col items-start gap-3">
              <div className="w-11 h-11 rounded-xl bg-[#01BBDC]/10 flex items-center justify-center">
                <Icon className="w-5 h-5 text-[#01BBDC]" />
              </div>
              <h3 className="font-bold text-[#10214F] text-lg">{title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-6 py-16">
        <div className="text-center mb-10">
          <h2 className="text-3xl font-bold text-[#10214F] mb-3">Apply Now</h2>
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
              <input
                type="tel"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#01BBDC] transition-colors text-[#2E2E2E] placeholder-gray-400"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-[#10214F] mb-1.5">
                Years in Yacht Brokerage
              </label>
              <select
                value={yearsExperience}
                onChange={e => setYearsExperience(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:border-[#01BBDC] transition-colors text-[#2E2E2E] bg-white"
              >
                <option value="">Select...</option>
                <option value="Less than 1 year">Less than 1 year</option>
                <option value="1–3 years">1–3 years</option>
                <option value="3–5 years">3–5 years</option>
                <option value="5–10 years">5–10 years</option>
                <option value="10+ years">10+ years</option>
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
