'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Ship, Building2, User, CheckCircle, ArrowRight, 
  Sparkles, TrendingUp, Users, DollarSign, Camera,
  BarChart3, Shield, Zap, Globe, Target, Clock
} from 'lucide-react';

export default function SellYourYachtPage() {
  const router = useRouter();
  const [sellerType, setSellerType] = useState<'broker' | 'private' | null>(null);

  const sellerTypes = [
    {
      id: 'broker' as const,
      icon: Building2,
      title: 'Professional Broker/Dealer',
      description: 'List multiple yachts, manage inventory, and access professional tools',
      features: [
        'Unlimited yacht listings',
        'AI-powered listing import',
        'Team management tools',
        'Advanced analytics dashboard',
        'Priority customer support',
        'Featured listing options'
      ],
      cta: 'Start Free Trial',
      route: '/register?type=dealer'
    },
    {
      id: 'private' as const,
      icon: User,
      title: 'Private Seller',
      description: 'Sell your personal yacht with expert guidance and powerful tools',
      features: [
        'Simple listing creation',
        'Professional listing templates',
        'Photo enhancement tools',
        'Direct buyer communication',
        'Price guidance & analytics',
        'Secure messaging system'
      ],
      cta: 'List Your Yacht',
      route: '/register?type=user'
    }
  ];

  const howItWorksSteps = {
    broker: [
      {
        step: 1,
        icon: CheckCircle,
        title: 'Create Your Account',
        description: 'Sign up for a free trial. No credit card required. Choose the plan that fits your business.'
      },
      {
        step: 2,
        icon: Camera,
        title: 'Add Your Inventory',
        description: 'Use our AI import tool to automatically scrape listings from your website, or create listings manually with our easy-to-use form.'
      },
      {
        step: 3,
        icon: Users,
        title: 'Manage Your Team',
        description: 'Add sales representatives, set permissions, and collaborate efficiently. Each rep can manage their own listings.'
      },
      {
        step: 4,
        icon: TrendingUp,
        title: 'Track Performance',
        description: 'Monitor views, leads, and sales with our comprehensive analytics dashboard. Optimize your listings for maximum visibility.'
      }
    ],
    private: [
      {
        step: 1,
        icon: CheckCircle,
        title: 'Create Your Listing',
        description: 'Fill out a simple form with your yacht details. Our guided process makes it easy, even if you\'ve never sold a yacht before.'
      },
      {
        step: 2,
        icon: Camera,
        title: 'Upload Photos',
        description: 'Add high-quality photos of your yacht. Our photo tools help you present your vessel in the best light possible.'
      },
      {
        step: 3,
        icon: DollarSign,
        title: 'Set Your Price',
        description: 'Use our market data and pricing guidance to set a competitive price. You can always adjust it later based on interest.'
      },
      {
        step: 4,
        icon: Users,
        title: 'Connect with Buyers',
        description: 'Receive inquiries through our secure messaging system. Respond to interested buyers and schedule viewings.'
      }
    ]
  };

  const benefits = [
    {
      icon: Globe,
      title: 'Global Reach',
      description: 'Your listing reaches thousands of qualified buyers worldwide'
    },
    {
      icon: Sparkles,
      title: 'AI-Powered Tools',
      description: 'Advanced technology makes listing creation fast and effective'
    },
    {
      icon: Shield,
      title: 'Verified Platform',
      description: 'All users are verified for a safe, secure marketplace'
    },
    {
      icon: BarChart3,
      title: 'Real-Time Analytics',
      description: 'Track views, engagement, and optimize your listings'
    },
    {
      icon: Zap,
      title: 'Instant Notifications',
      description: 'Get alerted immediately when buyers show interest'
    },
    {
      icon: Target,
      title: 'Targeted Exposure',
      description: 'Reach buyers actively searching for yachts like yours'
    }
  ];

  const pricingPlans = {
    broker: [
      {
        name: 'Basic',
        price: '$99',
        period: '/month',
        description: 'Perfect for small brokerages',
        features: [
          'Unlimited listings',
          'AI listing import',
          'Basic analytics',
          'Email support',
          'Mobile app access',
          '1 team member'
        ],
        popular: false
      },
      {
        name: 'Professional',
        price: '$199',
        period: '/month',
        description: 'Most popular for growing businesses',
        features: [
          'Everything in Basic',
          'Up to 5 team members',
          'Advanced analytics',
          'Priority support',
          '3 featured listings/month',
          'Custom branding'
        ],
        popular: true
      },
      {
        name: 'Enterprise',
        price: 'Custom',
        period: '',
        description: 'For large brokerages',
        features: [
          'Everything in Professional',
          'Unlimited team members',
          'Dedicated account manager',
          'Unlimited featured listings',
          'API access',
          'White-label options'
        ],
        popular: false
      }
    ],
    private: [
      {
        name: 'Single Listing',
        price: '$49',
        period: '/30 days',
        description: 'List one yacht for 30 days',
        features: [
          '1 yacht listing',
          'Up to 50 photos',
          'Basic analytics',
          'Buyer messaging',
          'Mobile app access',
          'Price alert feature'
        ],
        popular: false
      },
      {
        name: 'Premium Listing',
        price: '$99',
        period: '/60 days',
        description: 'Enhanced visibility',
        features: [
          'Everything in Single',
          'Extended 60-day duration',
          'Featured placement',
          'Homepage carousel',
          'Priority in search',
          'Photo enhancement'
        ],
        popular: true
      }
    ]
  };

  const testimonials = [
    {
      name: 'Michael Roberts',
      role: 'Owner, Roberts Yacht Sales',
      image: null,
      quote: 'YachtVersal transformed our business. The AI import tool saved us hundreds of hours, and we\'ve seen a 40% increase in qualified leads.',
      rating: 5
    },
    {
      name: 'Sarah Chen',
      role: 'Private Seller',
      image: null,
      quote: 'I sold my 45-foot sailboat in just 3 weeks! The platform made it so easy, and the buyers were all serious and pre-qualified.',
      rating: 5
    },
    {
      name: 'James Wellington',
      role: 'CEO, Premium Yachts International',
      image: null,
      quote: 'The analytics and team management features are incredible. We can track every lead and optimize our listings in real-time.',
      rating: 5
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-soft to-white">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary/10 via-white to-primary/5 py-24 border-b border-primary/20 overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 border-2 border-primary/30 mb-6">
            <Ship className="w-10 h-10 text-primary" />
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold text-secondary mb-6">
            Sell Your Yacht on<br />
            <span className="text-primary">YachtVersal</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-dark/70 mb-12 max-w-3xl mx-auto">
            Join thousands of dealers and private sellers reaching qualified buyers worldwide. 
            List in minutes with our AI-powered tools.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
            <button
              onClick={() => router.push('/register?type=dealer')}
              className="px-8 py-4 bg-primary text-white rounded-xl font-semibold text-lg hover:bg-primary/90 transition-all shadow-xl hover:shadow-2xl hover:scale-105"
            >
              Start Free Trial
            </button>
            <button
              onClick={() => {
                document.getElementById('choose-type')?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-8 py-4 border-2 border-primary text-primary rounded-xl font-semibold text-lg hover:bg-primary/5 transition-all"
            >
              Learn More
            </button>
          </div>

          <p className="text-sm text-gray-500">
            ✓ No credit card required • ✓ 14-day free trial • ✓ Cancel anytime
          </p>
        </div>
      </section>

      {/* Choose Your Path */}
      <section id="choose-type" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-secondary mb-4">
              Choose Your Path
            </h2>
            <p className="text-xl text-dark/70 max-w-2xl mx-auto">
              Whether you're a professional broker or private seller, we have the perfect solution for you
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
            {sellerTypes.map((type) => (
              <div
                key={type.id}
                onClick={() => setSellerType(type.id)}
                className={`group relative bg-gradient-to-br from-white to-soft rounded-3xl border-2 p-8 cursor-pointer transition-all hover:shadow-2xl ${
                  sellerType === type.id
                    ? 'border-primary shadow-2xl scale-105'
                    : 'border-gray-200 hover:border-primary/50'
                }`}
              >
                {sellerType === type.id && (
                  <div className="absolute -top-4 right-8 px-4 py-2 bg-primary text-white rounded-full text-sm font-semibold">
                    Selected ✓
                  </div>
                )}

                <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <type.icon className="w-8 h-8 text-primary" />
                </div>

                <h3 className="text-2xl font-bold text-secondary mb-3">
                  {type.title}
                </h3>

                <p className="text-dark/70 mb-6">
                  {type.description}
                </p>

                <ul className="space-y-3 mb-8">
                  {type.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <CheckCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                      <span className="text-dark">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    router.push(type.route);
                  }}
                  className="w-full px-6 py-4 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2 group-hover:scale-105"
                >
                  {type.cta}
                  <ArrowRight size={20} />
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      {sellerType && (
        <section className="py-20 bg-gradient-to-b from-gray-50 to-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                How It Works
              </h2>
              <p className="text-xl text-gray-600">
                {sellerType === 'broker' 
                  ? 'Get your brokerage up and running in minutes'
                  : 'List your yacht in four simple steps'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {howItWorksSteps[sellerType].map((step, idx) => (
                <div key={idx} className="relative">
                  <div className="bg-white rounded-2xl border border-gray-200 p-8 hover:shadow-lg transition-all h-full">
                    <div className="absolute -top-4 -left-4 w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center font-bold text-xl shadow-lg">
                      {step.step}
                    </div>

                    <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center mb-6 mt-4">
                      <step.icon className="w-7 h-7 text-primary" />
                    </div>

                    <h3 className="text-xl font-bold text-gray-900 mb-3">
                      {step.title}
                    </h3>

                    <p className="text-gray-600 leading-relaxed">
                      {step.description}
                    </p>
                  </div>

                  {idx < howItWorksSteps[sellerType].length - 1 && (
                    <div className="hidden lg:block absolute top-1/2 -right-4 w-8 h-0.5 bg-primary/30" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Benefits */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Why Choose YachtVersal?
            </h2>
            <p className="text-xl text-gray-600">
              The most powerful yacht marketplace platform
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {benefits.map((benefit, idx) => (
              <div
                key={idx}
                className="bg-gradient-to-br from-gray-50 to-white rounded-2xl border border-gray-200 p-8 hover:shadow-lg hover:border-primary/30 transition-all"
              >
                <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center mb-6">
                  <benefit.icon className="w-7 h-7 text-primary" />
                </div>

                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  {benefit.title}
                </h3>

                <p className="text-gray-600 leading-relaxed">
                  {benefit.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      {sellerType && (
        <section className="py-20 bg-gradient-to-b from-gray-50 to-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                Simple, Transparent Pricing
              </h2>
              <p className="text-xl text-gray-600">
                {sellerType === 'broker' 
                  ? 'Choose the plan that fits your business'
                  : 'Affordable options for private sellers'}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
              {pricingPlans[sellerType].map((plan, idx) => (
                <div
                  key={idx}
                  className={`relative bg-white rounded-3xl border-2 p-8 ${
                    plan.popular
                      ? 'border-primary shadow-2xl scale-105'
                      : 'border-gray-200'
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-6 py-2 bg-primary text-white rounded-full text-sm font-semibold">
                      Most Popular
                    </div>
                  )}

                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    {plan.name}
                  </h3>

                  <div className="mb-4">
                    <span className="text-4xl font-bold text-gray-900">{plan.price}</span>
                    <span className="text-gray-600">{plan.period}</span>
                  </div>

                  <p className="text-gray-600 mb-6">
                    {plan.description}
                  </p>

                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, featureIdx) => (
                      <li key={featureIdx} className="flex items-start gap-3">
                        <CheckCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                        <span className="text-gray-700 text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => router.push(`/register?type=${sellerType}&plan=${plan.name.toLowerCase()}`)}
                    className={`w-full px-6 py-4 rounded-xl font-semibold transition-all ${
                      plan.popular
                        ? 'bg-primary text-white hover:bg-primary/90 shadow-lg hover:shadow-xl'
                        : 'border-2 border-gray-300 text-gray-700 hover:border-primary hover:text-primary'
                    }`}
                  >
                    Get Started
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Testimonials */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
              Trusted by Thousands
            </h2>
            <p className="text-xl text-gray-600">
              See what our sellers are saying
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, idx) => (
              <div
                key={idx}
                className="bg-gradient-to-br from-gray-50 to-white rounded-2xl border border-gray-200 p-8 hover:shadow-lg transition-all"
              >
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <span key={i} className="text-yellow-400 text-xl">★</span>
                  ))}
                </div>

                <p className="text-gray-700 leading-relaxed mb-6 italic">
                  "{testimonial.quote}"
                </p>

                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-lg">
                    {testimonial.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{testimonial.name}</p>
                    <p className="text-sm text-gray-600">{testimonial.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-gradient-to-br from-primary/10 via-white to-primary/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-white rounded-3xl shadow-2xl border border-primary/20 p-12">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Ready to Start Selling?
            </h2>

            <p className="text-xl text-gray-600 mb-8">
              Join YachtVersal today and reach qualified buyers worldwide
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => router.push('/register?type=dealer')}
                className="px-8 py-4 bg-primary text-white rounded-xl font-semibold text-lg hover:bg-primary/90 transition-all shadow-xl hover:shadow-2xl hover:scale-105"
              >
                Start Free Trial
              </button>
              <button
                onClick={() => router.push('/contact')}
                className="px-8 py-4 border-2 border-primary text-primary rounded-xl font-semibold text-lg hover:bg-primary/5 transition-all"
              >
                Contact Sales
              </button>
            </div>

            <div className="mt-8 pt-8 border-t border-gray-200">
              <p className="text-sm text-gray-600">
                Questions? Call us at <strong>1-800-YACHTS</strong> or email <strong>sales@yachtversal.com</strong>
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}