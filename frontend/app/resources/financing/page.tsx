'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, FileText, Wallet, Clock, TrendingUp, Building2, Coins, Calendar, Shield } from 'lucide-react';

export default function FinancingPage() {
  const [purchasePrice, setPurchasePrice] = useState(500000);
  const [downPayment, setDownPayment] = useState(100000);
  const [loanTermYears, setLoanTermYears] = useState(20);
  const [interestRate, setInterestRate] = useState(6.49);
  const [monthlyPayment, setMonthlyPayment] = useState<number | null>(null);

  const loanAmount = purchasePrice - downPayment;

  const calculate = () => {
    const principal = purchasePrice - downPayment;
    if (principal <= 0 || interestRate <= 0 || loanTermYears <= 0) {
      setMonthlyPayment(0);
      return;
    }
    const monthlyRate = interestRate / 100 / 12;
    const numPayments = loanTermYears * 12;
    const payment =
      (principal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments))) /
      (Math.pow(1 + monthlyRate, numPayments) - 1);
    setMonthlyPayment(payment);
  };

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(val);

  const infoCards = [
    {
      icon: FileText,
      title: 'Loan Terms Flexibility',
      desc: 'Loan terms vary based on vessel type, age, and value',
    },
    {
      icon: Wallet,
      title: 'Flexible Down Payments',
      desc: 'Down payments typically range from 10–30%',
    },
    {
      icon: Clock,
      title: 'Extended Loan Durations',
      desc: 'Loan durations often span 10–20 years',
    },
    {
      icon: TrendingUp,
      title: 'Market Interest Rates',
      desc: 'Interest rates depend on market conditions and borrower profile',
    },
  ];

  const whyCards = [
    {
      icon: Building2,
      title: 'Marine Lending Specialists',
      desc: 'We work with experienced lenders who understand yacht ownership.',
    },
    {
      icon: Coins,
      title: 'Competitive Rates',
      desc: 'Access tailored financing structures suited to your profile.',
    },
    {
      icon: Calendar,
      title: 'Flexible Loan Terms',
      desc: 'Choose repayment options that align with your long term plans.',
    },
    {
      icon: Shield,
      title: 'Secure & Transparent Process',
      desc: 'Clear communication and professional guidance from start to finish.',
    },
  ];

  const approvalFactors = [
    { title: 'Credit profile', desc: 'Affects approval and interest rate.' },
    { title: 'Down Payment Size', desc: 'Impacts loan strength and payments.' },
    { title: 'Yacht Age & Value', desc: 'Determines financing eligibility.' },
    { title: 'Loan Duration', desc: 'Changes monthly payment amount.' },
  ];

  return (
    <main className="relative bg-white">
      {/* ─── HERO ─────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden" style={{ height: 401 }}>
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/images/financing-hero.jpg')", backgroundPosition: 'right center' }}
        />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, #FFFFFF 0%, #FFFFFF 23%, rgba(255,255,255,0) 70%)' }} />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col justify-center" style={{ height: 401 }}>
          <div className="max-w-2xl pt-24 pb-16">
            <h1
              className="font-bold mb-4 leading-tight"
              style={{ color: '#10214F', fontFamily: 'Bahnschrift, DIN Alternate, sans-serif', fontSize: 'clamp(40px, 5vw, 56px)', lineHeight: '1.2' }}
            >
              Financing Your Yacht
            </h1>
            <p className="text-base" style={{ color: '#10214F', fontFamily: 'Poppins, sans-serif' }}>
              Many buyers choose to finance their yacht rather than purchase outright.
            </p>
          </div>
        </div>
      </section>

      {/* ─── HOW YACHT FINANCING WORKS ────────────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-semibold mb-3" style={{ color: '#10214F', fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>
              How Yacht Financing Works
            </h2>
            <p className="text-base" style={{ color: '#10214F', fontFamily: 'Poppins, sans-serif' }}>
              A simple process designed to keep things clear and efficient.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {infoCards.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.title}
                  className="bg-white rounded-2xl p-6 flex flex-col gap-4"
                  style={{ border: '1px solid rgba(16,33,79,0.1)' }}
                >
                  <Icon className="w-8 h-8" style={{ color: '#01BBDC' }} />
                  <h3 className="text-xl font-normal leading-snug" style={{ color: '#10214F', fontFamily: 'Bahnschrift, DIN Alternate, sans-serif', fontSize: 22 }}>
                    {card.title}
                  </h3>
                  <p className="text-sm" style={{ color: '#10214F', fontFamily: 'Poppins, sans-serif' }}>
                    {card.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── LOAN CALCULATOR ──────────────────────────────────────── */}
      <section className="py-20" style={{ backgroundColor: 'rgba(16,33,79,0.02)' }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-semibold mb-3" style={{ color: '#10214F', fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>
              Loan Calculator for Yacht Financing
            </h2>
            <p className="text-base max-w-xl mx-auto" style={{ color: '#10214F', fontFamily: 'Poppins, sans-serif' }}>
              Use our calculator to explore financing options and understand your estimated yearly or monthly investment.
            </p>
          </div>

          {/* Calculator Card */}
          <div className="rounded-2xl overflow-hidden shadow-sm" style={{ border: '1px solid rgba(0,0,0,0.1)' }}>
            <div className="grid grid-cols-1 lg:grid-cols-2">
              {/* Left - Inputs */}
              <div className="bg-white p-8 lg:p-10">
                <div className="space-y-6">
                  {/* Purchase Price */}
                  <div>
                    <label className="block text-sm mb-2" style={{ color: '#10214F', fontFamily: 'Poppins, sans-serif' }}>
                      Purchase Price
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'rgba(16,33,79,0.6)', fontFamily: 'Poppins, sans-serif' }}>$</span>
                      <input
                        type="number"
                        value={purchasePrice}
                        onChange={(e) => setPurchasePrice(Number(e.target.value))}
                        className="w-full pl-7 pr-4 py-3 rounded-lg text-sm focus:outline-none focus:border-[#01BBDC]"
                        style={{ border: '1px solid rgba(0,0,0,0.1)', color: 'rgba(16,33,79,0.6)', fontFamily: 'Poppins, sans-serif' }}
                      />
                    </div>
                  </div>

                  {/* Down Payment */}
                  <div>
                    <label className="block text-sm mb-2" style={{ color: '#10214F', fontFamily: 'Poppins, sans-serif' }}>
                      Down Payment
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'rgba(16,33,79,0.6)', fontFamily: 'Poppins, sans-serif' }}>$</span>
                      <input
                        type="number"
                        value={downPayment}
                        onChange={(e) => setDownPayment(Number(e.target.value))}
                        className="w-full pl-7 pr-4 py-3 rounded-lg text-sm focus:outline-none focus:border-[#01BBDC]"
                        style={{ border: '1px solid rgba(0,0,0,0.1)', color: 'rgba(16,33,79,0.6)', fontFamily: 'Poppins, sans-serif' }}
                      />
                    </div>
                  </div>

                  {/* Loan Amount (read only) */}
                  <div>
                    <label className="block text-sm mb-2" style={{ color: '#10214F', fontFamily: 'Poppins, sans-serif' }}>
                      Loan Amount
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'rgba(16,33,79,0.6)', fontFamily: 'Poppins, sans-serif' }}>$</span>
                      <input
                        type="text"
                        value={loanAmount.toLocaleString()}
                        readOnly
                        className="w-full pl-7 pr-4 py-3 rounded-lg text-sm bg-gray-50"
                        style={{ border: '1px solid rgba(0,0,0,0.1)', color: 'rgba(16,33,79,0.6)', fontFamily: 'Poppins, sans-serif' }}
                      />
                    </div>
                  </div>

                  {/* Loan Term */}
                  <div className="grid grid-cols-2 gap-4 items-end">
                    <div>
                      <label className="block text-sm mb-2" style={{ color: '#10214F', fontFamily: 'Poppins, sans-serif' }}>
                        Loan term in years
                      </label>
                      <input
                        type="number"
                        value={loanTermYears}
                        onChange={(e) => setLoanTermYears(Number(e.target.value))}
                        className="w-full px-4 py-3 rounded-lg text-sm focus:outline-none focus:border-[#01BBDC]"
                        style={{ border: '1px solid rgba(0,0,0,0.1)', color: 'rgba(16,33,79,0.6)', fontFamily: 'Poppins, sans-serif' }}
                      />
                    </div>
                    <div className="flex items-center justify-center pb-3">
                      <span className="text-sm" style={{ color: 'rgba(16,33,79,0.6)', fontFamily: 'Poppins, sans-serif' }}>Or</span>
                    </div>
                    <div className="col-span-2 -mt-4">
                      <label className="block text-sm mb-2" style={{ color: '#10214F', fontFamily: 'Poppins, sans-serif' }}>
                        Loan term in months
                      </label>
                      <input
                        type="number"
                        value={loanTermYears * 12}
                        onChange={(e) => setLoanTermYears(Math.round(Number(e.target.value) / 12))}
                        className="w-full px-4 py-3 rounded-lg text-sm focus:outline-none focus:border-[#01BBDC]"
                        style={{ border: '1px solid rgba(0,0,0,0.1)', color: 'rgba(16,33,79,0.6)', fontFamily: 'Poppins, sans-serif' }}
                      />
                    </div>
                  </div>

                  {/* Interest Rate + Calculate */}
                  <div className="grid grid-cols-2 gap-4 items-end">
                    <div>
                      <label className="block text-sm mb-2" style={{ color: '#10214F', fontFamily: 'Poppins, sans-serif' }}>
                        Interest Rate (APR)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          value={interestRate}
                          onChange={(e) => setInterestRate(Number(e.target.value))}
                          className="w-full px-4 py-3 rounded-lg text-sm focus:outline-none focus:border-[#01BBDC]"
                          style={{ border: '1px solid rgba(0,0,0,0.1)', color: 'rgba(16,33,79,0.6)', fontFamily: 'Poppins, sans-serif' }}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'rgba(16,33,79,0.6)' }}>%</span>
                      </div>
                    </div>
                    <div>
                      <button
                        onClick={calculate}
                        className="w-full py-3 rounded-lg text-white text-sm font-normal transition-opacity hover:opacity-90"
                        style={{ backgroundColor: '#01BBDC', fontFamily: 'Poppins, sans-serif' }}
                      >
                        Calculate
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right - Result */}
              <div className="flex flex-col items-center justify-center p-10 min-h-[300px]" style={{ backgroundColor: '#10214F' }}>
                {monthlyPayment !== null ? (
                  <div className="text-center">
                    <p className="text-white text-2xl font-semibold mb-4" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>
                      Monthly Payment
                    </p>
                    <p className="text-white font-semibold" style={{ fontFamily: 'Bahnschrift, DIN Alternate, sans-serif', fontSize: 48, lineHeight: 1.2 }}>
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(monthlyPayment)}
                    </p>
                    <div className="mt-8 text-center space-y-2">
                      <p className="text-white/60 text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>
                        Total Loan: {formatCurrency(loanAmount)}
                      </p>
                      <p className="text-white/60 text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>
                        Total Paid: {formatCurrency(monthlyPayment * loanTermYears * 12)}
                      </p>
                      <p className="text-white/60 text-sm" style={{ fontFamily: 'Poppins, sans-serif' }}>
                        Total Interest: {formatCurrency(monthlyPayment * loanTermYears * 12 - loanAmount)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-white/60 text-lg mb-2" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      Monthly Payment
                    </p>
                    <p className="text-white/30 text-base" style={{ fontFamily: 'Poppins, sans-serif' }}>
                      Enter your details and click Calculate
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── WHY FINANCE THROUGH YACHTVERSAL ─────────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-semibold text-center mb-12" style={{ color: '#10214F', fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>
            Why Finance Through YachtVersal
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {whyCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.title} className="flex items-start gap-5">
                  <div
                    className="flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: 'rgba(16,33,79,0.05)' }}
                  >
                    <Icon className="w-6 h-6" style={{ color: '#01BBDC' }} />
                  </div>
                  <div>
                    <h3 className="text-xl font-normal mb-1" style={{ color: '#10214F', fontFamily: 'Bahnschrift, DIN Alternate, sans-serif', fontSize: 22 }}>
                      {card.title}
                    </h3>
                    <p className="text-base" style={{ color: '#10214F', fontFamily: 'Poppins, sans-serif' }}>
                      {card.desc}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── WHAT IMPACTS YOUR FINANCING APPROVAL ─────────────────── */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Image */}
            <div className="rounded-2xl overflow-hidden shadow-xl" style={{ minHeight: 493 }}>
              <div
                className="w-full h-full min-h-[493px] bg-cover bg-center rounded-2xl"
                style={{ backgroundImage: "url('/images/dock-inspection.jpg')" }}
              />
            </div>
            {/* Content */}
            <div>
              <h2 className="text-3xl font-semibold mb-10" style={{ color: '#10214F', fontFamily: 'Bahnschrift, DIN Alternate, sans-serif' }}>
                What Impacts Your Financing Approval?
              </h2>
              <div className="space-y-8">
                {approvalFactors.map((factor) => (
                  <div key={factor.title}>
                    <div className="flex items-center gap-3 mb-1">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: '#01BBDC' }}>
                        <Check className="w-4 h-4 text-white" strokeWidth={3} />
                      </span>
                      <h3 className="font-normal" style={{ color: '#10214F', fontFamily: 'Bahnschrift, DIN Alternate, sans-serif', fontSize: 22 }}>
                        {factor.title}
                      </h3>
                    </div>
                    <p className="pl-9 text-base" style={{ color: '#10214F', fontFamily: 'Poppins, sans-serif', lineHeight: '30px' }}>
                      {factor.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA SECTION ──────────────────────────────────────────── */}
      <section className="relative overflow-hidden" style={{ minHeight: 479 }}>
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('/images/elegant-yacht-lagoon.jpg')" }}
        />
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(90deg, #FFFFFF 0%, rgba(255,255,255,0.95) 41%, rgba(255,255,255,0) 70%)' }}
        />
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col justify-center" style={{ minHeight: 479 }}>
          <div className="max-w-lg py-16">
            <h2
              className="font-normal mb-4"
              style={{ color: '#10214F', fontFamily: 'Bahnschrift, DIN Alternate, sans-serif', fontSize: 40, lineHeight: '48px' }}
            >
              Ready to Start Your Search?
            </h2>
            <p className="text-base mb-1" style={{ color: '#01BBDC', fontFamily: 'Poppins, sans-serif' }}>
              Skip the Filters - Find the Yacht
            </p>
            <p className="text-base mb-8" style={{ color: '#10214F', fontFamily: 'Poppins, sans-serif' }}>
              Describe what you're looking for and let YachtVersal guide the way.
            </p>
            <Link
              href="/listings"
              className="inline-flex items-center justify-center px-6 py-3 rounded-xl text-white font-medium text-base transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#01BBDC', fontFamily: 'Poppins, sans-serif' }}
            >
              Search Listings
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}