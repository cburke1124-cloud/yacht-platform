'use client';

import Link from 'next/link';
import { Shield, Eye, Lock, Users, Mail, FileText, Cpu, Building2, Key } from 'lucide-react';

export default function PrivacyPolicyPage() {
  const lastUpdated = "March 2, 2026";

  const sections = [
    {
      icon: Eye,
      title: "Information We Collect",
      content: [
        {
          subtitle: "Personal Information",
          text: "When you create an account or use our services, we collect information such as your name, email address, phone number, company information (for dealers), brokerage license details, and payment details processed by Stripe."
        },
        {
          subtitle: "Listing Information",
          text: "If you are a dealer, we collect information about the vessels you list, including descriptions, specifications, pricing, images, videos, documents, and location data. Where you enable website data import, we also collect listing data automatically retrieved from your public website — see the Dealer-Specific Data section below."
        },
        {
          subtitle: "Search Queries and Alerts",
          text: "We collect your search queries (typed and AI-assisted), saved search criteria, price alert configurations, and saved listings. This data is used to operate alert features and personalize your experience. You can delete saved searches and alerts at any time through your account settings."
        },
        {
          subtitle: "Geolocation Data",
          text: "With your browser's permission, we collect your approximate geographic location to sort search results by proximity and display nearby listings. This location data is used only for the current session and is not stored on our servers after your session ends. You can deny or revoke location permission through your browser settings at any time."
        },
        {
          subtitle: "AI Search Queries",
          text: "When you use our AI-powered natural-language search feature, your query text is transmitted to Anthropic's Claude API for processing. Queries are not stored long-term on YachtVersal's servers and are not used by us to train AI models. Anthropic's handling of query data is governed by Anthropic's privacy policy."
        },
        {
          subtitle: "Messages and Communications",
          text: "We retain messages sent through the in-platform messaging system between buyers and dealers for safety, fraud prevention, and dispute resolution purposes."
        },
        {
          subtitle: "Usage Data",
          text: "We automatically collect information about how you interact with our platform, including pages visited, search queries, saved listings, click events, session duration, device type, browser, and IP address."
        },
        {
          subtitle: "API Key Activity",
          text: "For dealer accounts that generate API keys, we log API request metadata (timestamp, endpoint, response code, IP address) for security monitoring, abuse detection, and rate-limit enforcement. We do not log the full content of API responses."
        },
        {
          subtitle: "Cookies and Tracking",
          text: "We use cookies and similar technologies to maintain session state, remember preferences, and analyze platform usage. See our Cookie Policy for details."
        }
      ]
    },
    {
      icon: Lock,
      title: "How We Use Your Information",
      content: [
        {
          subtitle: "Service Delivery",
          text: "We use your information to provide, maintain, and improve our yacht marketplace, process subscription payments, facilitate buyer-dealer communications, and operate platform features including messaging, alerts, and the dealer dashboard."
        },
        {
          subtitle: "Search Alerts and Price Alerts",
          text: "We use your stored search criteria and price alert configurations to send you email notifications when new matching listings are added or prices change. You can unsubscribe from individual alerts or all alert emails at any time."
        },
        {
          subtitle: "AI-Assisted Features",
          text: "We transmit your search queries to Anthropic's Claude API to generate natural-language search results. We use aggregated, anonymized query patterns internally to improve search quality."
        },
        {
          subtitle: "Personalization",
          text: "Your browsing history, saved listings, and search patterns help us surface relevant listings, recommend vessels, and rank results in a way that reflects your interests."
        },
        {
          subtitle: "Communication",
          text: "We send transactional emails (inquiry confirmations, security alerts, billing receipts), alert notifications, and — with your consent — marketing communications. You can manage communication preferences in Account Settings."
        },
        {
          subtitle: "Safety, Security, and Fraud Prevention",
          text: "We use account data, API logs, device information, and behavior patterns to detect fraud, verify dealer credentials, enforce rate limits, and maintain the integrity of our marketplace."
        },
        {
          subtitle: "Legal Compliance",
          text: "We may use your information to comply with applicable laws, respond to legal process, enforce our Terms of Service, and protect the rights, property, or safety of YachtVersal, our users, or the public."
        }
      ]
    },
    {
      icon: Users,
      title: "Information Sharing",
      content: [
        {
          subtitle: "With Dealers — Buyer Inquiries",
          text: "When you submit an inquiry, start a conversation, or express interest in a listing, your name, email address, and phone number are shared with the dealer who posted that listing so they can respond. Dealers are independent data controllers for the contact information they receive and must handle it in accordance with their own privacy obligations. Dealers may not add your contact details to third-party mailing lists."
        },
        {
          subtitle: "Via the API — Co-Brokering",
          text: "Dealer listing data (title, specifications, price, images, and location) is accessible to authorized third-party brokers and websites through our public API. This is a core marketplace feature. No buyer personal data is included in API responses. Dealers may opt out of API co-brokering in their dashboard."
        },
        {
          subtitle: "Named Third-Party Service Providers",
          text: "We share data with the following trusted service providers, each operating under data-processing agreements: Stripe (subscription billing and payment processing — stripe.com/privacy); Anthropic (AI search query processing — anthropic.com/privacy); OpenStreetMap / Nominatim (map tile rendering and address geocoding — openstreetmap.org/privacy); Vercel (frontend hosting and edge network — vercel.com/legal/privacy-policy); Render (backend hosting and managed PostgreSQL database — render.com/privacy)."
        },
        {
          subtitle: "Communications Providers",
          text: "If you have opted in to SMS notifications, your phone number is shared with our SMS delivery provider for the sole purpose of sending those messages. You can opt out of SMS at any time."
        },
        {
          subtitle: "Legal Requirements",
          text: "We may disclose information when required by law, subpoena, or court order, or when we believe disclosure is necessary to protect our rights, prevent fraud, or ensure user safety."
        },
        {
          subtitle: "Business Transfers",
          text: "In the event of a merger, acquisition, financing, or sale of all or a portion of our assets, your information may be transferred to the successor entity. We will provide notice before such a transfer and require the successor to honor this Privacy Policy."
        }
      ]
    },
    {
      icon: Cpu,
      title: "AI Processing",
      content: [
        {
          subtitle: "How AI Search Works",
          text: "Our AI search feature sends your natural-language query to Anthropic's Claude API, which interprets the query and returns structured search parameters. YachtVersal then uses those parameters to query our listings database. Your raw query text is transmitted to Anthropic's servers in the United States."
        },
        {
          subtitle: "No AI Training on Your Data",
          text: "YachtVersal does not use your queries or personal data to train, fine-tune, or improve AI models. Our agreement with Anthropic prohibits the use of customer inputs for model training purposes."
        },
        {
          subtitle: "AI Results Disclaimer",
          text: "AI-generated search results may be incomplete or imprecise. You should not rely solely on AI search results when making purchasing decisions."
        },
        {
          subtitle: "Opting Out",
          text: "AI search is an optional feature. You can use the standard keyword search at any time without transmitting queries to Anthropic."
        }
      ]
    },
    {
      icon: Building2,
      title: "Dealer-Specific Data",
      content: [
        {
          subtitle: "CRM and Lead Data",
          text: "When a buyer submits an inquiry, their contact information is stored in the dealer's CRM dashboard. Dealers are independent data controllers for this lead data. Buyers may request deletion of their data from a dealer's CRM by contacting us at privacy@yachtversal.com; we will forward the request to the relevant dealer and facilitate removal from the platform's records."
        },
        {
          subtitle: "Website Data Import (Scraping)",
          text: "Dealers who enable the website data import feature expressly authorize YachtVersal to programmatically collect listing data from their public-facing web pages. The authorization and its scope are detailed in the Dealer Services Agreement. Scraped data is treated as dealer-submitted content and is subject to the same retention and deletion rules."
        },
        {
          subtitle: "Team Member Data",
          text: "When a dealer invites team members or sales representatives, we collect and store their name, email address, role, and profile information. This data is visible within the dealer's account and, for salesman profiles, publicly on the platform."
        },
        {
          subtitle: "API Key Logs",
          text: "API key usage logs (timestamps, endpoints, IP addresses) are retained for 90 days for security and abuse investigation. Logs are not used for marketing or profiling."
        },
        {
          subtitle: "Dealer Media",
          text: "Photos, videos, and other media uploaded by dealers are retained for the duration of their account and for up to 18 months following account termination, as described in the Dealer Services Agreement. Media may be used in marketing materials during that window in accordance with the media license granted upon upload."
        }
      ]
    },
    {
      icon: Key,
      title: "API Access and Third-Party Integrations",
      content: [
        {
          subtitle: "Personal API Keys",
          text: "Dealer accounts may generate personal API keys from the dashboard. API key activity is logged as described above. You are responsible for keeping your keys secure. You can revoke API keys at any time from the dashboard, which immediately invalidates them."
        },
        {
          subtitle: "Third-Party Apps Built on API Keys",
          text: "If you share your API key with a third-party application, YachtVersal is not responsible for how that application handles data returned by the API. Review the privacy policies of any third-party applications you authorize."
        }
      ]
    },
    {
      icon: Shield,
      title: "Your Rights and Choices",
      content: [
        {
          subtitle: "Access and Correction",
          text: "You can access and update your personal information through Account Settings at any time."
        },
        {
          subtitle: "Data Deletion",
          text: "You may request deletion of your account and associated personal data by contacting privacy@yachtversal.com. We will honor deletion requests subject to legal retention obligations (e.g., billing records, fraud investigation holds). Note that deleting your account does not automatically delete your contact information from an individual dealer's CRM — contact us and we will facilitate that separately."
        },
        {
          subtitle: "Saved Searches, Alerts, and Saved Listings",
          text: "You can delete individual saved searches, price alerts, and saved listings at any time from your account settings. Deletion removes the stored criteria and stops future notifications."
        },
        {
          subtitle: "Geolocation",
          text: "You can deny or revoke location permission through your browser settings at any time. Revoking location access will disable proximity-sorted search results but does not otherwise affect platform functionality."
        },
        {
          subtitle: "Marketing Preferences",
          text: "You can opt out of marketing emails by using the unsubscribe link in any marketing email or through Account Settings → Preferences. Transactional emails (security, billing, inquiry confirmations) cannot be disabled while your account is active."
        },
        {
          subtitle: "AI Search Opt-Out",
          text: "AI search is an optional feature. You may use the standard keyword search without transmitting queries to Anthropic's API."
        },
        {
          subtitle: "CCPA / GDPR Rights",
          text: "Depending on your jurisdiction, you may have additional rights including the right to know what data we hold, the right to portability, the right to object to processing, and the right to lodge a complaint with a supervisory authority. Contact privacy@yachtversal.com to exercise any of these rights."
        },
        {
          subtitle: "Cookie Controls",
          text: "You can manage cookie preferences through your browser settings or our cookie consent interface, though disabling certain cookies may affect platform functionality."
        }
      ]
    },
    {
      icon: FileText,
      title: "Data Security and Retention",
      content: [
        {
          subtitle: "Security Measures",
          text: "We implement industry-standard security measures including TLS encryption in transit, encrypted storage, regular security audits, access controls, and principle-of-least-privilege on database access."
        },
        {
          subtitle: "Data Retention",
          text: "Account data is retained for the lifetime of your account plus 30 days following deletion (to allow recovery from accidental closure). Billing records are retained for 7 years as required by tax law. Search alert criteria are deleted when you remove the alert or close your account. API logs are retained for 90 days. Dealer media is subject to the 18-month wind-down in the Dealer Services Agreement."
        },
        {
          subtitle: "Data Breaches",
          text: "In the event of a data breach that is likely to result in a risk to your rights, we will notify affected users as required by applicable law, including within 72 hours where required under GDPR."
        },
        {
          subtitle: "International Transfers",
          text: "YachtVersal operates primarily in the United States. Data is stored on servers operated by Render and Vercel, both US-based. Where we transfer data to third-party processors (e.g., Anthropic for AI search), we ensure appropriate safeguards are in place, including data processing agreements compliant with applicable privacy law."
        }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-soft to-white">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary/10 via-white to-primary/5 py-20 border-b border-primary/20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 border-2 border-primary/30 mb-6">
            <Shield className="w-10 h-10 text-primary" />
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold text-secondary mb-6">
            Privacy Policy
          </h1>
          
          <p className="text-xl text-dark/70 mb-4">
            Your privacy is important to us. This policy explains how we collect, use, and protect your information.
          </p>
          
          <p className="text-sm text-dark/70">
            Last Updated: <span className="font-semibold">{lastUpdated}</span>
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Introduction */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-12">
            <p className="text-dark leading-relaxed mb-4">
              YachtVersal ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our yacht marketplace platform.
            </p>
            <p className="text-dark leading-relaxed">
              By using YachtVersal, you agree to the collection and use of information in accordance with this policy. If you do not agree with our policies and practices, please do not use our services.
            </p>
          </div>

          {/* Main Sections */}
          <div className="space-y-12">
            {sections.map((section, idx) => (
              <div key={idx} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-6 border-b border-gray-200">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                      <section.icon className="w-6 h-6 text-primary" />
                    </div>
                    <h2 className="text-2xl font-bold text-secondary">{section.title}</h2>
                  </div>
                </div>
                
                <div className="p-8 space-y-6">
                  {section.content.map((item, itemIdx) => (
                    <div key={itemIdx}>
                      <h3 className="text-lg font-semibold text-gray-900 mb-3">
                        {item.subtitle}
                      </h3>
                      <p className="text-gray-700 leading-relaxed">
                        {item.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Children's Privacy */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 mt-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Children's Privacy</h2>
            <p className="text-gray-700 leading-relaxed">
              Our services are not intended for individuals under the age of 18. We do not knowingly collect personal information from children. If you believe we have inadvertently collected information from a child under 18, please contact us immediately at privacy@yachtversal.com and we will delete it promptly.
            </p>
          </div>

          {/* Contact Section */}
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-8 mt-8 border border-primary/20">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
                <Mail className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-secondary mb-3">Contact Us</h2>
                <p className="text-dark leading-relaxed mb-4">
                  For questions about this Privacy Policy, to exercise your data rights, or to request deletion of your data:
                </p>
                <div className="space-y-2 text-dark text-sm">
                  <p><strong>Privacy inquiries:</strong> privacy@yachtversal.com</p>
                  <p><strong>Legal / Compliance:</strong> legal@yachtversal.com</p>
                  <p><strong>Mail:</strong> YachtVersal Privacy Team, [Address], [City, State ZIP]</p>
                </div>
                <p className="text-dark/60 text-xs mt-4 leading-relaxed">
                  We aim to respond to all privacy requests within 30 days. For urgent matters, please include "URGENT" in your subject line.
                </p>
              </div>
            </div>
          </div>

          {/* Related Policies */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
            <Link
              href="/terms"
              className="flex items-center gap-3 p-5 bg-white border border-gray-200 rounded-2xl hover:border-primary/40 transition-colors"
            >
              <FileText className="w-5 h-5 text-primary flex-shrink-0" />
              <div>
                <p className="font-semibold text-secondary text-sm">General Terms of Service</p>
                <p className="text-gray-500 text-xs">For all users and buyers</p>
              </div>
            </Link>
            <Link
              href="/terms/dealer"
              className="flex items-center gap-3 p-5 bg-white border border-gray-200 rounded-2xl hover:border-primary/40 transition-colors"
            >
              <FileText className="w-5 h-5 text-primary flex-shrink-0" />
              <div>
                <p className="font-semibold text-secondary text-sm">Dealer Services Agreement</p>
                <p className="text-gray-500 text-xs">Data import, API, media rights</p>
              </div>
            </Link>
          </div>

          {/* Changes Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mt-6">
            <p className="text-dark leading-relaxed text-sm">
              <strong>Changes to This Policy:</strong> We may update this Privacy Policy from time to time. We will notify you of material changes by email and by posting the updated policy on this page at least 14 days before changes take effect. The "Last Updated" date at the top of this page reflects the most recent revision. We encourage you to review this policy periodically.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}