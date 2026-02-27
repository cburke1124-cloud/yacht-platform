'use client';

import { useState } from 'react';
import { HelpCircle, ChevronDown, Search, Ship, DollarSign, Users, Shield, Sparkles, MessageSquare } from 'lucide-react';

export default function FAQPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [openQuestions, setOpenQuestions] = useState<number[]>([]);

  const categories = [
    { id: 'all', label: 'All Questions', icon: HelpCircle },
    { id: 'buyers', label: 'For Buyers', icon: Ship },
    { id: 'dealers', label: 'For Dealers', icon: Users },
    { id: 'pricing', label: 'Pricing & Plans', icon: DollarSign },
    { id: 'features', label: 'Features', icon: Sparkles },
    { id: 'security', label: 'Security', icon: Shield }
  ];

  const faqs = [
    {
      category: 'buyers',
      question: 'How do I search for yachts on YachtVersal?',
      answer: 'You can search for yachts using our advanced search bar on the homepage or listings page. Filter by price range, boat type, length, year, location, and more. You can also save searches to receive alerts when new matching listings are added.'
    },
    {
      category: 'buyers',
      question: 'Are the listings verified?',
      answer: 'All dealers on YachtVersal go through a verification process. However, we recommend buyers conduct their own due diligence, including yacht surveys and sea trials before making a purchase. We are a marketplace platform connecting buyers and sellers.'
    },
    {
      category: 'buyers',
      question: 'How do I contact a seller about a yacht?',
      answer: 'Click on any listing to view full details, then use the "Contact Seller" button to send a message directly to the dealer. You can also save listings to compare them later or set up price alerts to track changes.'
    },
    {
      category: 'buyers',
      question: 'Can I save my favorite yachts?',
      answer: 'Yes! Create a free account to save unlimited yacht listings. You can access your saved yachts anytime from your account dashboard. You can also organize them into collections for easier comparison.'
    },
    {
      category: 'buyers',
      question: 'What are price alerts?',
      answer: 'Price alerts notify you when a yacht you\'re interested in has a price change. Set up alerts on any listing by clicking the "Set Price Alert" button. You\'ll receive email notifications when the price drops or increases.'
    },
    {
      category: 'dealers',
      question: 'How do I list my yachts for sale?',
      answer: 'Create a dealer account, choose a subscription plan, and start listing immediately. You can manually create listings or use our AI-powered import tool to scrape listings from your existing website. All plans include unlimited listings.'
    },
    {
      category: 'dealers',
      question: 'What is the AI listing import feature?',
      answer: 'Our AI scraper tool can automatically import yacht listings from your website or other platforms. Simply provide the URL, and our AI extracts all relevant information including specs, descriptions, and images, creating professional listings in seconds.'
    },
    {
      category: 'dealers',
      question: 'Can I manage multiple sales representatives?',
      answer: 'Yes! Our Team and Enterprise plans allow you to add multiple sales representatives with customizable permissions. Each rep can manage their own listings and leads while you maintain oversight through the admin dashboard.'
    },
    {
      category: 'dealers',
      question: 'How do leads work?',
      answer: 'When a buyer expresses interest in your listing, you receive a lead notification with their contact information. All leads are tracked in your dashboard with timestamps, contact history, and follow-up reminders.'
    },
    {
      category: 'dealers',
      question: 'Can I feature my listings?',
      answer: 'Yes! Featured listings appear prominently in search results and on the homepage carousel. Featured slots are included in higher-tier plans or available as add-ons. Featured listings receive up to 5x more views.'
    },
    {
      category: 'pricing',
      question: 'What subscription plans do you offer?',
      answer: 'We offer four plans: Free (for buyers), Basic ($99/month), Professional ($199/month), and Enterprise (custom pricing). All dealer plans include unlimited listings, AI import tools, and lead management. Higher tiers add team management, priority support, and featured listings.'
    },
    {
      category: 'pricing',
      question: 'Is there a free trial?',
      answer: 'Yes! All dealer plans come with a 14-day free trial. No credit card required to start. You can cancel anytime during the trial period with no charges.'
    },
    {
      category: 'pricing',
      question: 'Are there any transaction fees?',
      answer: 'No. YachtVersal does not charge transaction fees or commissions on sales. You only pay your monthly subscription fee. All transactions are directly between you and the buyer.'
    },
    {
      category: 'pricing',
      question: 'Can I cancel my subscription anytime?',
      answer: 'Yes, you can cancel your subscription at any time. Your account will remain active until the end of your current billing period. You can reactivate anytime without losing your listings or data.'
    },
    {
      category: 'features',
      question: 'What image formats are supported?',
      answer: 'We support JPG, PNG, and WebP formats for images. Maximum file size is 10MB per image. We recommend high-quality images (at least 1920x1080) for best presentation. You can upload up to 50 images per listing.'
    },
    {
      category: 'features',
      question: 'Can I add videos to my listings?',
      answer: 'Yes! You can add YouTube or Vimeo video links to any listing. Videos significantly increase engagement and help showcase yachts more effectively. Videos appear in the main gallery alongside images.'
    },
    {
      category: 'features',
      question: 'How does the messaging system work?',
      answer: 'Our built-in messaging system allows direct communication between buyers and dealers. All messages are stored in your dashboard with conversation history. You receive email notifications for new messages and can respond directly from email.'
    },
    {
      category: 'features',
      question: 'What analytics are available?',
      answer: 'All dealer accounts include analytics showing listing views, inquiries, search appearances, and engagement metrics. Track which listings perform best and optimize your inventory accordingly. Export reports monthly for your records.'
    },
    {
      category: 'security',
      question: 'How is my data protected?',
      answer: 'We use industry-standard encryption (SSL/TLS) for all data transmission. Payment information is processed through PCI-compliant providers. We never store credit card details on our servers. Regular security audits ensure platform integrity.'
    },
    {
      category: 'security',
      question: 'How do you verify dealers?',
      answer: 'All dealers must provide business documentation, verify their identity, and pass our background checks. We verify business licenses, insurance, and references. Dealers must maintain good standing and comply with our terms of service.'
    },
    {
      category: 'security',
      question: 'What if I suspect fraudulent activity?',
      answer: 'Report any suspicious activity immediately through our contact form or email security@yachtversal.com. We investigate all reports promptly and take appropriate action. We have zero tolerance for fraudulent behavior.'
    }
  ];

  const toggleQuestion = (index: number) => {
    setOpenQuestions(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const filteredFaqs = faqs.filter(faq => {
    const matchesCategory = activeCategory === 'all' || faq.category === activeCategory;
    const matchesSearch = searchQuery === '' ||
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-soft to-white">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary/10 via-white to-primary/5 py-20 border-b border-primary/20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 border-2 border-primary/30 mb-6">
            <HelpCircle className="w-10 h-10 text-primary" />
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold text-secondary mb-6">
            Frequently Asked Questions
          </h1>
          
          <p className="text-xl text-dark/70 mb-8">
            Find answers to common questions about YachtVersal
          </p>

          {/* Search Bar */}
          <div className="max-w-2xl mx-auto">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search questions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-4 rounded-xl border-2 border-gray-200 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all text-lg"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Category Filters */}
      <section className="py-8 border-b border-gray-200 bg-white sticky top-16 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {categories.map(category => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold whitespace-nowrap transition-all ${
                  activeCategory === category.id
                    ? 'bg-primary text-white shadow-lg scale-105'
                    : 'bg-section-light text-dark hover:bg-dark/10'
                }`}
              >
                <category.icon size={18} />
                {category.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Content */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {filteredFaqs.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 rounded-full bg-section-light flex items-center justify-center mx-auto mb-4">
                <Search className="w-10 h-10 text-dark/40" />
              </div>
              <h3 className="text-2xl font-bold text-secondary mb-2">No questions found</h3>
              <p className="text-dark/70">Try adjusting your search or category filter</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredFaqs.map((faq, index) => (
                <div
                  key={index}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden transition-all hover:shadow-md"
                >
                  <button
                    onClick={() => toggleQuestion(index)}
                    className="w-full px-6 py-5 flex items-center justify-between text-left hover:bg-section-light transition-colors"
                  >
                    <span className="text-lg font-semibold text-dark pr-4">
                      {faq.question}
                    </span>
                    <ChevronDown
                      className={`w-6 h-6 text-primary flex-shrink-0 transition-transform ${
                        openQuestions.includes(index) ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  
                  {openQuestions.includes(index) && (
                    <div className="px-6 pb-6 pt-2">
                      <div className="border-t border-gray-200 pt-4">
                        <p className="text-dark leading-relaxed">
                          {faq.answer}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Contact CTA */}
      <section className="py-16 bg-gradient-to-br from-primary/10 to-primary/5">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="bg-white rounded-2xl shadow-lg border border-primary/20 p-8 md:p-12">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-6">
              <MessageSquare className="w-8 h-8 text-primary" />
            </div>
            
            <h2 className="text-3xl font-bold text-secondary mb-4">
              Still have questions?
            </h2>
            
            <p className="text-lg text-dark/70 mb-8">
              Can't find the answer you're looking for? Our support team is here to help.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="/contact"
                className="px-8 py-4 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-all shadow-lg hover:shadow-xl hover:scale-105"
              >
                Contact Support
              </a>
              
              <a
                href="mailto:support@yachtversal.com"
                className="px-8 py-4 border-2 border-primary text-primary rounded-xl font-semibold hover:bg-primary/10 transition-all"
              >
                Email Us
              </a>
            </div>

            <div className="mt-8 pt-8 border-t border-gray-200">
              <p className="text-sm text-dark/70">
                <strong>Email:</strong> support@yachtversal.com • <strong>Phone:</strong> 1-800-YACHTS
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}