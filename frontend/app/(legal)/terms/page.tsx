'use client';

import { FileText, UserCheck, ShieldAlert, DollarSign, Scale, AlertTriangle } from 'lucide-react';

export default function TermsOfServicePage() {
  const lastUpdated = "January 12, 2026";

  const sections = [
    {
      icon: UserCheck,
      title: "Account Terms",
      content: [
        {
          subtitle: "Account Creation",
          text: "You must be at least 18 years old to create an account. You are responsible for maintaining the security of your account credentials and for all activities under your account."
        },
        {
          subtitle: "Account Types",
          text: "We offer different account types including User accounts (for buyers), Dealer accounts (for yacht sellers), and Sales Representative accounts. Each type has specific permissions and responsibilities."
        },
        {
          subtitle: "Account Termination",
          text: "We reserve the right to suspend or terminate accounts that violate these terms, engage in fraudulent activity, or pose risks to our platform or users."
        },
        {
          subtitle: "Accurate Information",
          text: "You agree to provide accurate, current, and complete information during registration and to update it as necessary to maintain its accuracy."
        }
      ]
    },
    {
      icon: DollarSign,
      title: "Listing and Transactions",
      content: [
        {
          subtitle: "Dealer Listings",
          text: "Dealers are responsible for the accuracy of their yacht listings, including descriptions, specifications, pricing, and images. All listings must comply with applicable laws and regulations."
        },
        {
          subtitle: "Platform Role",
          text: "YachtVersal is a marketplace platform connecting buyers and sellers. We are not a party to transactions between users and dealers. All sales agreements are directly between the buyer and dealer."
        },
        {
          subtitle: "Pricing and Fees",
          text: "Dealers pay subscription fees for platform access and listing capabilities. All fees are outlined in our pricing page and are subject to change with reasonable notice."
        },
        {
          subtitle: "Transaction Disputes",
          text: "While we strive to facilitate smooth transactions, we are not responsible for disputes between buyers and dealers. Users should conduct due diligence before entering any agreements."
        }
      ]
    },
    {
      icon: ShieldAlert,
      title: "Prohibited Activities",
      content: [
        {
          subtitle: "Fraudulent Behavior",
          text: "Users may not engage in fraudulent activities, misrepresent listings, provide false information, or attempt to deceive other users."
        },
        {
          subtitle: "Unauthorized Use",
          text: "You may not use automated systems, bots, or scrapers to access our platform without permission. Circumventing security measures is strictly prohibited."
        },
        {
          subtitle: "Content Violations",
          text: "Users may not post illegal content, infringe intellectual property rights, or upload harmful software or malicious code."
        },
        {
          subtitle: "Interference",
          text: "You may not interfere with the proper functioning of the platform, overload our systems, or engage in activities that harm other users' experience."
        }
      ]
    },
    {
      icon: Scale,
      title: "Intellectual Property",
      content: [
        {
          subtitle: "Platform Content",
          text: "All content on YachtVersal, including text, graphics, logos, software, and design, is owned by YachtVersal or our licensors and protected by intellectual property laws."
        },
        {
          subtitle: "User Content",
          text: "You retain ownership of content you upload but grant us a license to use, display, and distribute it on our platform. You warrant that you have the rights to any content you upload."
        },
        {
          subtitle: "Trademarks",
          text: "YachtVersal, our logo, and related marks are trademarks. You may not use them without our prior written permission."
        },
        {
          subtitle: "DMCA Compliance",
          text: "We respect intellectual property rights. If you believe content on our platform infringes your copyright, please contact us with a detailed notice."
        }
      ]
    },
    {
      icon: AlertTriangle,
      title: "Disclaimers and Limitations",
      content: [
        {
          subtitle: "No Warranties",
          text: "The platform is provided \"as is\" without warranties of any kind. We do not guarantee uninterrupted access, error-free operation, or the accuracy of listings."
        },
        {
          subtitle: "Third-Party Content",
          text: "Listings and information provided by dealers are their responsibility. We do not verify all content and make no representations about its accuracy."
        },
        {
          subtitle: "Limitation of Liability",
          text: "To the maximum extent permitted by law, YachtVersal shall not be liable for indirect, incidental, special, or consequential damages arising from your use of the platform."
        },
        {
          subtitle: "Indemnification",
          text: "You agree to indemnify and hold YachtVersal harmless from claims arising from your use of the platform, violation of these terms, or infringement of third-party rights."
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
            <FileText className="w-10 h-10 text-primary" />
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold text-secondary mb-6">
            Terms of Service
          </h1>
          
          <p className="text-xl text-dark/70 mb-4">
            Please read these terms carefully before using YachtVersal. By accessing our platform, you agree to be bound by these terms.
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
            <h2 className="text-2xl font-bold text-secondary mb-4">Agreement to Terms</h2>
            <p className="text-dark leading-relaxed mb-4">
              These Terms of Service ("Terms") govern your access to and use of YachtVersal's website, mobile application, and related services (collectively, the "Platform"). This is a binding legal agreement between you and YachtVersal.
            </p>
            <p className="text-dark leading-relaxed">
              By accessing or using the Platform, you acknowledge that you have read, understood, and agree to be bound by these Terms and our Privacy Policy. If you do not agree to these Terms, you must not access or use the Platform.
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
                      <h3 className="text-lg font-semibold text-secondary mb-3">
                        {item.subtitle}
                      </h3>
                      <p className="text-dark leading-relaxed">
                        {item.text}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Governing Law */}
          <div className="bg-gradient-to-br from-section-light to-white rounded-2xl p-8 mt-12 border border-gray-200">
            <h2 className="text-2xl font-bold text-secondary mb-4">Governing Law and Disputes</h2>
            <div className="space-y-4 text-dark leading-relaxed">
              <p>
                These Terms shall be governed by and construed in accordance with the laws of the State of Florida, United States, without regard to its conflict of law provisions.
              </p>
              <p>
                Any disputes arising from these Terms or your use of the Platform shall be resolved through binding arbitration in accordance with the rules of the American Arbitration Association. You agree to waive any right to a jury trial or to participate in a class action.
              </p>
            </div>
          </div>

          {/* Modifications */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 mt-8">
            <h2 className="text-2xl font-bold text-secondary mb-4">Modifications to Terms</h2>
            <p className="text-dark leading-relaxed">
              We reserve the right to modify these Terms at any time. We will notify users of material changes via email or platform notification. Your continued use of the Platform after such modifications constitutes acceptance of the updated Terms. We encourage you to review these Terms periodically.
            </p>
          </div>

          {/* Severability */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-8 mt-8">
            <h2 className="text-2xl font-bold text-secondary mb-4">Severability</h2>
            <p className="text-dark leading-relaxed">
              If any provision of these Terms is found to be unenforceable or invalid, that provision will be limited or eliminated to the minimum extent necessary so that these Terms will otherwise remain in full force and effect.
            </p>
          </div>

          {/* Contact Section */}
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl p-8 mt-12 border border-primary/20">
            <h2 className="text-2xl font-bold text-secondary mb-4">Questions About These Terms?</h2>
            <p className="text-dark leading-relaxed mb-4">
              If you have any questions about these Terms of Service, please contact us:
            </p>
            <div className="space-y-2 text-dark">
              <p><strong>Email:</strong> legal@yachtversal.com</p>
              <p><strong>Phone:</strong> 1-800-YACHTS</p>
              <p><strong>Mail:</strong> YachtVersal Legal Department, 123 Marina Blvd, Suite 100, Miami, FL 33101</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}