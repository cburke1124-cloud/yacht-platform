'use client';

import { Cookie, Shield, Eye, Settings, Trash2, RefreshCw } from 'lucide-react';

export default function CookiePolicyPage() {
  const lastUpdated = "January 12, 2026";

  const cookieTypes = [
    {
      icon: Shield,
      title: "Essential Cookies",
      description: "These cookies are necessary for the website to function and cannot be switched off in our systems.",
      color: "green",
      examples: [
        {
          name: "session_token",
          purpose: "Maintains your login session",
          duration: "Session (until browser close)",
          type: "First-party"
        },
        {
          name: "csrf_token",
          purpose: "Security protection against cross-site request forgery",
          duration: "Session",
          type: "First-party"
        },
        {
          name: "cookie_consent",
          purpose: "Remembers your cookie preferences",
          duration: "1 year",
          type: "First-party"
        }
      ]
    },
    {
      icon: Eye,
      title: "Analytics Cookies",
      description: "These cookies allow us to count visits and traffic sources so we can measure and improve the performance of our site.",
      color: "blue",
      examples: [
        {
          name: "_ga",
          purpose: "Google Analytics - distinguishes users",
          duration: "2 years",
          type: "Third-party"
        },
        {
          name: "_gid",
          purpose: "Google Analytics - distinguishes users",
          duration: "24 hours",
          type: "Third-party"
        },
        {
          name: "_gat",
          purpose: "Google Analytics - throttle request rate",
          duration: "1 minute",
          type: "Third-party"
        }
      ]
    },
    {
      icon: Settings,
      title: "Functional Cookies",
      description: "These cookies enable the website to provide enhanced functionality and personalization.",
      color: "purple",
      examples: [
        {
          name: "preferred_language",
          purpose: "Remembers your language preference",
          duration: "1 year",
          type: "First-party"
        },
        {
          name: "theme_preference",
          purpose: "Stores your theme selection (light/dark mode)",
          duration: "1 year",
          type: "First-party"
        },
        {
          name: "search_filters",
          purpose: "Remembers your search filter preferences",
          duration: "30 days",
          type: "First-party"
        }
      ]
    },
    {
      icon: Settings,
      title: "Marketing/Advertising Cookies",
      description: "These cookies may be set through our site by our advertising partners to build a profile of your interests.",
      color: "orange",
      examples: [
        {
          name: "_fbp",
          purpose: "Facebook Pixel - tracks conversions and retargeting",
          duration: "3 months",
          type: "Third-party"
        },
        {
          name: "fr",
          purpose: "Facebook advertising delivery and analytics",
          duration: "3 months",
          type: "Third-party"
        },
        {
          name: "IDE",
          purpose: "Google advertising - measures ad performance",
          duration: "1 year",
          type: "Third-party"
        }
      ]
    }
  ];

  const getColorClasses = (color: string) => {
    const colors: Record<string, { bg: string; border: string; icon: string; badge: string }> = {
      green: {
        bg: 'from-green-50 to-green-100/50',
        border: 'border-green-200',
        icon: 'text-green-600',
        badge: 'bg-green-100 text-green-700'
      },
      blue: {
        bg: 'from-blue-50 to-blue-100/50',
        border: 'border-blue-200',
        icon: 'text-blue-600',
        badge: 'bg-blue-100 text-blue-700'
      },
      purple: {
        bg: 'from-purple-50 to-purple-100/50',
        border: 'border-purple-200',
        icon: 'text-purple-600',
        badge: 'bg-purple-100 text-purple-700'
      },
      orange: {
        bg: 'from-orange-50 to-orange-100/50',
        border: 'border-orange-200',
        icon: 'text-orange-600',
        badge: 'bg-orange-100 text-orange-700'
      }
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-soft to-white">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary/10 via-white to-primary/5 py-20 border-b border-primary/20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 border-2 border-primary/30 mb-6">
            <Cookie className="w-10 h-10 text-primary" />
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold text-secondary mb-6">
            Cookie Policy
          </h1>
          
          <p className="text-xl text-dark/70 mb-4">
            Learn about how YachtVersal uses cookies to enhance your browsing experience
          </p>
          
          <p className="text-sm text-dark/70">
            Last Updated: <span className="font-semibold">{lastUpdated}</span>
          </p>
        </div>
      </section>

      {/* Introduction */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-12">
            <h2 className="text-3xl font-bold text-secondary mb-6">What Are Cookies?</h2>
            
            <div className="space-y-4 text-dark leading-relaxed">
              <p>
                Cookies are small text files that are placed on your computer or mobile device when you visit a website. 
                They are widely used to make websites work more efficiently and provide information to the site owners.
              </p>
              
              <p>
                YachtVersal uses cookies to enhance your experience, provide personalized content, analyze site traffic, 
                and deliver targeted advertisements. This Cookie Policy explains what cookies we use and why.
              </p>

              <div className="bg-primary/5 border border-primary/20 rounded-xl p-6 mt-6">
                <p className="font-semibold text-secondary mb-2">Your Control</p>
                <p className="text-dark">
                  You can control and manage cookies through your browser settings and our cookie consent banner. 
                  Note that disabling certain cookies may impact your experience on our website.
                </p>
              </div>
            </div>
          </div>

          {/* Cookie Types */}
          <div className="space-y-8">
            {cookieTypes.map((category, idx) => {
              const colors = getColorClasses(category.color);
              return (
                <div key={idx} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className={`bg-gradient-to-r ${colors.bg} p-6 border-b ${colors.border}`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl bg-white border ${colors.border} flex items-center justify-center`}>
                        <category.icon className={`w-6 h-6 ${colors.icon}`} />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold text-secondary">{category.title}</h3>
                        <p className="text-sm text-dark/70 mt-1">{category.description}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="p-6">
                    <div className="space-y-4">
                      {category.examples.map((cookie, cookieIdx) => (
                        <div key={cookieIdx} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
                          <div className="flex items-start justify-between mb-3">
                            <div>
                              <h4 className="font-bold text-secondary mb-1">{cookie.name}</h4>
                              <p className="text-sm text-dark/70">{cookie.purpose}</p>
                            </div>
                            <span className={`px-3 py-1 ${colors.badge} rounded-full text-xs font-semibold whitespace-nowrap ml-4`}>
                              {cookie.type}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-dark/60">
                            <span>Duration: <strong>{cookie.duration}</strong></span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Third-Party Cookies */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 mt-12">
            <h2 className="text-2xl font-bold text-secondary mb-4 flex items-center gap-3">
              <Shield className="w-7 h-7 text-amber-600" />
              Third-Party Cookies
            </h2>
            <div className="space-y-4 text-dark">
              <p>
                In addition to our own cookies, we may also use various third-party cookies to report usage statistics, 
                deliver advertisements, and enhance functionality.
              </p>
              <p className="font-semibold">Third-party services we use include:</p>
              <ul className="space-y-2 ml-6">
                <li>• <strong>Google Analytics:</strong> For website traffic analysis and user behavior insights</li>
                <li>• <strong>Facebook Pixel:</strong> For ad targeting and conversion tracking</li>
                <li>• <strong>Google Ads:</strong> For advertising delivery and performance measurement</li>
                <li>• <strong>Hotjar:</strong> For user experience analysis and feedback collection</li>
              </ul>
              <p className="text-sm mt-4">
                These services have their own privacy policies. We recommend reviewing their policies to understand 
                how they use your information.
              </p>
            </div>
          </div>

          {/* Managing Cookies */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mt-12">
            <h2 className="text-2xl font-bold text-secondary mb-6 flex items-center gap-3">
              <Settings className="w-7 h-7 text-primary" />
              How to Manage Cookies
            </h2>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-secondary mb-3 flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-primary" />
                  Using Our Cookie Consent Tool
                </h3>
                <p className="text-dark">
                  When you first visit YachtVersal, you'll see our cookie consent banner. You can choose to:
                </p>
                <ul className="mt-2 space-y-2 ml-6 text-dark">
                  <li>• Accept all cookies</li>
                  <li>• Accept only essential cookies</li>
                  <li>• Customize your preferences</li>
                </ul>
                <p className="text-dark mt-3">
                  You can change your preferences anytime by clicking the cookie settings icon in the footer 
                  or visiting your account settings.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-secondary mb-3 flex items-center gap-2">
                  <Trash2 className="w-5 h-5 text-red-600" />
                  Browser Settings
                </h3>
                <p className="text-dark mb-3">
                  Most web browsers allow you to control cookies through their settings. Here's how:
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { browser: 'Google Chrome', url: 'chrome://settings/cookies' },
                    { browser: 'Mozilla Firefox', url: 'about:preferences#privacy' },
                    { browser: 'Safari', url: 'Preferences > Privacy > Cookies' },
                    { browser: 'Microsoft Edge', url: 'edge://settings/privacy' }
                  ].map((item, idx) => (
                    <div key={idx} className="border border-gray-200 rounded-lg p-4">
                      <p className="font-semibold text-secondary mb-1">{item.browser}</p>
                      <p className="text-sm text-dark/70 font-mono">{item.url}</p>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-dark/70 mt-4">
                  Note: Blocking all cookies may prevent some features of our website from working properly.
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
                <h3 className="text-lg font-semibold text-secondary mb-2">Do Not Track (DNT)</h3>
                <p className="text-dark">
                  YachtVersal respects Do Not Track (DNT) browser signals. When DNT is enabled, we will not set 
                  non-essential cookies without your explicit consent.
                </p>
              </div>
            </div>
          </div>

          {/* Cookie Retention */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mt-12">
            <h2 className="text-2xl font-bold text-secondary mb-4">Cookie Retention</h2>
            <div className="space-y-4 text-dark">
              <p>
                Cookies we set will remain on your device for the duration specified in the cookie tables above. 
                Some cookies expire when you close your browser (session cookies), while others remain for a longer 
                period (persistent cookies).
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-secondary mb-2">Session Cookies</h4>
                  <p className="text-sm text-dark/70">
                    Deleted automatically when you close your browser. Used for essential functionality like 
                    maintaining your login state.
                  </p>
                </div>
                <div className="border border-gray-200 rounded-lg p-4">
                  <h4 className="font-semibold text-secondary mb-2">Persistent Cookies</h4>
                  <p className="text-sm text-dark/70">
                    Remain on your device for a set period or until manually deleted. Used for analytics and 
                    remembering your preferences.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Updates to Policy */}
          <div className="bg-gradient-to-br from-gray-50 to-white rounded-2xl border border-gray-200 p-8 mt-12">
            <h2 className="text-2xl font-bold text-secondary mb-4">Updates to This Policy</h2>
            <p className="text-dark leading-relaxed">
              We may update this Cookie Policy from time to time to reflect changes in technology, legislation, 
              our operations, or other factors. We will notify you of any material changes by posting the updated 
              policy on this page with a new "Last Updated" date. We encourage you to review this policy periodically.
            </p>
          </div>

          {/* Contact */}
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-8 mt-12 border border-primary/20">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Questions About Cookies?</h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              If you have questions about our use of cookies or this Cookie Policy, please contact us:
            </p>
            <div className="space-y-2 text-gray-700">
              <p><strong>Email:</strong> privacy@yachtversal.com</p>
              <p><strong>Phone:</strong> 1-800-YACHTS</p>
              <p><strong>Mail:</strong> YachtVersal Privacy Team, 123 Marina Blvd, Suite 100, Miami, FL 33101</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}