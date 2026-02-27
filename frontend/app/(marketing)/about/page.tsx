'use client';

import { Ship, Globe, Shield, Sparkles, Users, TrendingUp, Award, Heart, Zap, Target } from 'lucide-react';
import Link from 'next/link';

export default function AboutPage() {
  const values = [
    {
      icon: Heart,
      title: 'Customer First',
      description: 'Every decision we make puts our users and their needs at the center.'
    },
    {
      icon: Shield,
      title: 'Trust & Transparency',
      description: 'We believe in honest communication and verified information at every step.'
    },
    {
      icon: Sparkles,
      title: 'Innovation',
      description: 'Leveraging cutting-edge AI and technology to revolutionize yacht trading.'
    },
    {
      icon: Globe,
      title: 'Global Community',
      description: 'Connecting yacht enthusiasts and professionals worldwide.'
    }
  ];

  const stats = [
    { number: '10,000+', label: 'Active Listings', icon: Ship },
    { number: '5,000+', label: 'Verified Dealers', icon: Users },
    { number: '$2B+', label: 'Total Value', icon: TrendingUp },
    { number: '150+', label: 'Countries', icon: Globe }
  ];

  const features = [
    {
      icon: Sparkles,
      title: 'AI-Powered Tools',
      description: 'Import listings instantly with our intelligent scraping technology. Save hours of manual work.'
    },
    {
      icon: Globe,
      title: 'Global Reach',
      description: 'Connect with dealers and buyers worldwide. Your yacht reaches a truly international audience.'
    },
    {
      icon: Shield,
      title: 'Verified Dealers',
      description: 'All dealers are thoroughly verified and vetted for your complete peace of mind.'
    },
    {
      icon: Target,
      title: 'Comprehensive Listings',
      description: 'Detailed specifications, high-quality photos, videos, and virtual tours for every vessel.'
    },
    {
      icon: Zap,
      title: 'Instant Notifications',
      description: 'Get real-time alerts for new listings, price changes, and buyer inquiries.'
    },
    {
      icon: Award,
      title: 'Premium Experience',
      description: 'Industry-leading platform designed for both seasoned professionals and first-time buyers.'
    }
  ];

  const team = [
    {
      name: 'Michael Roberts',
      role: 'Co-Founder & CEO',
      bio: '20+ years in maritime industry and technology',
      image: null
    },
    {
      name: 'Sarah Chen',
      role: 'Co-Founder & CTO',
      bio: 'Former lead engineer at major tech companies',
      image: null
    },
    {
      name: 'James Wellington',
      role: 'Head of Dealer Relations',
      bio: 'Former yacht broker with global network',
      image: null
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-soft to-white">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary/10 via-white to-primary/5 py-24 border-b border-primary/20 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary/15 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 border-2 border-primary/30 mb-6">
            <Ship className="w-10 h-10 text-primary" />
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold text-secondary mb-6">
            About <span className="text-primary">YachtVersal</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-dark/70 mb-8 max-w-3xl mx-auto">
            The world's leading yacht marketplace, connecting buyers and sellers with innovation and trust
          </p>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Our Mission
            </h2>
            <div className="w-24 h-1 bg-primary mx-auto mb-8" />
          </div>

          <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-3xl border border-primary/20 p-8 md:p-12">
            <p className="text-xl text-dark leading-relaxed mb-6">
              YachtVersal is revolutionizing the yacht buying and selling experience by combining 
              cutting-edge AI technology with comprehensive marketplace features. We connect yacht 
              dealers and buyers worldwide, making the process of finding your dream vessel easier than ever.
            </p>
            <p className="text-lg text-dark/70 leading-relaxed">
              Our platform empowers dealers with powerful tools to manage their inventory efficiently 
              while providing buyers with unprecedented access to the world's finest yachts. We're not 
              just a marketplace—we're building the future of yacht commerce.
            </p>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-gradient-to-b from-soft to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-secondary mb-4">
              By The Numbers
            </h2>
            <p className="text-xl text-dark/70">
              Growing every day with our community
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl border border-gray-200 p-8 text-center hover:shadow-lg transition-all hover:scale-105"
              >
                <div className="w-16 h-16 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center mx-auto mb-4">
                  <stat.icon className="w-8 h-8 text-primary" />
                </div>
                <div className="text-4xl font-bold text-secondary mb-2">
                  {stat.number}
                </div>
                <div className="text-gray-600 font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What Makes Us Different */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-secondary mb-4">
              What Makes Us Different
            </h2>
            <p className="text-xl text-dark/70 max-w-2xl mx-auto">
              Innovation, trust, and excellence in every aspect
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, idx) => (
              <div
                key={idx}
                className="bg-gradient-to-br from-gray-50 to-white rounded-2xl border border-gray-200 p-8 hover:shadow-lg hover:border-primary/30 transition-all"
              >
                <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center mb-6">
                  <feature.icon className="w-7 h-7 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-20 bg-gradient-to-b from-soft to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-secondary mb-4">
              Our Values
            </h2>
            <p className="text-xl text-gray-600">
              The principles that guide everything we do
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {values.map((value, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl border border-gray-200 p-8 hover:shadow-lg transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center flex-shrink-0">
                    <value.icon className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-secondary mb-2">
                      {value.title}
                    </h3>
                    <p className="text-dark/70">
                      {value.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Our Story */}
      <section className="py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl md:text-5xl font-bold text-secondary mb-6">
              Our Story
            </h2>
            <div className="w-24 h-1 bg-primary mx-auto mb-8" />
          </div>

          <div className="space-y-6 text-lg text-dark leading-relaxed">
            <p>
              Founded in 2023 by yacht enthusiasts and tech innovators, YachtVersal was created to 
              solve the challenges we personally experienced in the yacht market. We saw an industry 
              ripe for innovation—fragmented listings, outdated technology, and inefficient processes 
              that frustrated both buyers and sellers.
            </p>
            
            <p>
              We assembled a team of maritime experts, software engineers, and industry veterans who 
              shared our vision: to create the world's most advanced yacht marketplace. One that would 
              leverage AI and modern technology while maintaining the personal touch that yacht 
              transactions deserve.
            </p>

            <p>
              Today, YachtVersal serves thousands of dealers and connects buyers with their dream 
              yachts across six continents. But we're just getting started. We're continuously 
              innovating, listening to our community, and building new features that make yacht 
              commerce more transparent, efficient, and enjoyable for everyone.
            </p>

            <p className="text-xl font-semibold text-secondary pt-6">
              We believe that buying or selling a yacht should be transparent, efficient, and enjoyable.
            </p>
          </div>
        </div>
      </section>

      {/* Leadership Team */}
      <section className="py-20 bg-gradient-to-b from-soft to-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-secondary mb-4">
              Leadership Team
            </h2>
            <p className="text-xl text-gray-600">
              Meet the people driving innovation at YachtVersal
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {team.map((member, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl border border-gray-200 p-8 text-center hover:shadow-lg transition-all"
              >
                <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6 text-primary font-bold text-3xl">
                  {member.name.split(' ').map(n => n[0]).join('')}
                </div>
                <h3 className="text-xl font-bold text-secondary mb-2">
                  {member.name}
                </h3>
                <p className="text-primary font-semibold mb-3">
                  {member.role}
                </p>
                <p className="text-dark/70 text-sm">
                  {member.bio}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact CTA */}
      <section className="py-20 bg-gradient-to-br from-primary/10 to-primary/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-white rounded-3xl shadow-2xl border border-primary/20 p-12">
            <h2 className="text-4xl md:text-5xl font-bold text-secondary mb-6">
              Get in Touch
            </h2>
            <p className="text-xl text-dark/70 mb-8">
              Have questions? We'd love to hear from you.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Link
                href="/contact"
                className="px-8 py-4 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-all shadow-lg hover:shadow-xl hover:scale-105"
              >
                Contact Us
              </Link>
              <Link
                href="/sell"
                className="px-8 py-4 border-2 border-primary text-primary rounded-xl font-semibold hover:bg-primary/5 transition-all"
              >
                Become a Dealer
              </Link>
            </div>

              <div className="pt-8 border-t border-gray-200 space-y-2 text-dark">
              <p><strong>Email:</strong> <a href="mailto:info@yachtversal.com" className="text-primary hover:underline">info@yachtversal.com</a></p>
              <p><strong>Phone:</strong> <a href="tel:1-800-YACHTS" className="text-primary hover:underline">1-800-YACHTS</a></p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}