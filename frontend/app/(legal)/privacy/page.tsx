'use client';

import { Shield, Eye, Lock, Users, Mail, FileText } from 'lucide-react';

export default function PrivacyPolicyPage() {
  const lastUpdated = "January 12, 2026";

  const sections = [
    {
      icon: Eye,
      title: "Information We Collect",
      content: [
        {
          subtitle: "Personal Information",
          text: "When you create an account or use our services, we collect information such as your name, email address, phone number, company information (for dealers), and payment details."
        },
        {
          subtitle: "Listing Information",
          text: "If you're a dealer, we collect information about the yachts you list, including descriptions, specifications, pricing, and images."
        },
        {
          subtitle: "Usage Data",
          text: "We automatically collect information about how you interact with our platform, including pages visited, search queries, saved listings, and device information."
        },
        {
          subtitle: "Cookies and Tracking",
          text: "We use cookies and similar technologies to enhance your experience, remember preferences, and analyze platform usage."
        }
      ]
    },
    {
      icon: Lock,
      title: "How We Use Your Information",
      content: [
        {
          subtitle: "Service Delivery",
          text: "We use your information to provide, maintain, and improve our yacht marketplace services, process transactions, and facilitate communications between buyers and dealers."
        },
        {
          subtitle: "Personalization",
          text: "Your data helps us personalize your experience, including customized search results, recommendations, and price alerts."
        },
        {
          subtitle: "Communication",
          text: "We may send you service updates, notifications about saved listings, marketing communications (with your consent), and responses to your inquiries."
        },
        {
          subtitle: "Safety and Security",
          text: "We use your information to detect fraud, ensure platform security, verify dealer credentials, and maintain the integrity of our marketplace."
        }
      ]
    },
    {
      icon: Users,
      title: "Information Sharing",
      content: [
        {
          subtitle: "With Dealers",
          text: "When you express interest in a yacht, we share your contact information with the relevant dealer to facilitate communication."
        },
        {
          subtitle: "Service Providers",
          text: "We work with trusted third-party service providers for payment processing, email delivery, analytics, and hosting services."
        },
        {
          subtitle: "Legal Requirements",
          text: "We may disclose information when required by law, to protect our rights, prevent fraud, or ensure user safety."
        },
        {
          subtitle: "Business Transfers",
          text: "In the event of a merger, acquisition, or sale of assets, your information may be transferred to the new entity."
        }
      ]
    },
    {
      icon: Shield,
      title: "Your Rights and Choices",
      content: [
        {
          subtitle: "Access and Correction",
          text: "You can access, update, or correct your personal information through your account settings at any time."
        },
        {
          subtitle: "Data Deletion",
          text: "You have the right to request deletion of your personal data, subject to legal and contractual obligations."
        },
        {
          subtitle: "Marketing Preferences",
          text: "You can opt out of marketing communications at any time by using the unsubscribe link in emails or updating your preferences."
        },
        {
          subtitle: "Cookie Controls",
          text: "You can manage cookie preferences through your browser settings, though this may affect platform functionality."
        }
      ]
    },
    {
      icon: FileText,
      title: "Data Security",
      content: [
        {
          subtitle: "Security Measures",
          text: "We implement industry-standard security measures including encryption, secure servers, regular security audits, and access controls to protect your data."
        },
        {
          subtitle: "Data Retention",
          text: "We retain your information for as long as necessary to provide services, comply with legal obligations, and resolve disputes."
        },
        {
          subtitle: "International Transfers",
          text: "Your data may be transferred to and processed in countries other than your own. We ensure appropriate safeguards are in place."
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
              Our services are not intended for individuals under the age of 18. We do not knowingly collect personal information from children. If you believe we have collected information from a child, please contact us immediately.
            </p>
          </div>

          {/* Contact Section */}
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-8 mt-12 border border-primary/20">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
                <Mail className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-secondary mb-3">Contact Us</h2>
                <p className="text-dark leading-relaxed mb-4">
                  If you have questions or concerns about this Privacy Policy or our data practices, please contact us:
                </p>
                <div className="space-y-2 text-dark">
                  <p><strong>Email:</strong> privacy@yachtversal.com</p>
                  <p><strong>Phone:</strong> 1-800-YACHTS</p>
                  <p><strong>Mail:</strong> YachtVersal Privacy Team, 123 Marina Blvd, Suite 100, Miami, FL 33101</p>
                </div>
              </div>
            </div>
          </div>

          {/* Changes Notice */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-6 mt-8">
            <p className="text-dark leading-relaxed">
              <strong>Changes to This Policy:</strong> We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last Updated" date. We encourage you to review this policy periodically.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}