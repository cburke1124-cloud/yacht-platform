import Link from 'next/link';
import { CheckCircle, ArrowRight } from 'lucide-react';

export default function FoundingBrokerThankYouPage() {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-6 py-20">
      <div className="max-w-lg w-full text-center">
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-[#01BBDC]/10 flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-[#01BBDC]" />
          </div>
        </div>

        <h1 className="text-4xl font-bold text-[#10214F] mb-4">
          Thank You for Signing Up With YachtVersal
        </h1>

        <p className="text-lg text-gray-500 mb-8 leading-relaxed">
          A representative will be in touch with you soon to help you get started as a founding broker.
          We're excited to have you on board.
        </p>

        <div className="bg-[#F5F7FA] border border-gray-200 rounded-2xl p-6 mb-10 text-left">
          <h2 className="font-semibold text-[#10214F] mb-3">What happens next?</h2>
          <ul className="space-y-3 text-sm text-gray-600">
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[#01BBDC] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</span>
              Our team reviews your application and creates your account.
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[#01BBDC] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</span>
              You'll receive login credentials and an onboarding guide by email.
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[#01BBDC] text-white text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</span>
              A dedicated representative will reach out to help you publish your first listings.
            </li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/listings"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-[#01BBDC] text-white font-semibold rounded-xl hover:bg-[#00a5c4] transition-all shadow-md"
          >
            Browse Listings
            <ArrowRight size={16} />
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 border-2 border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 transition-all"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
