'use client';

import Link from 'next/link';
import {
  Building2, FileText, Globe, Image, Code2, Users, Wrench,
  Star, ShieldAlert, DollarSign, Scale, ArrowLeft, Key, Share2, Shield, CreditCard
} from 'lucide-react';

export default function BrokerServicesAgreementPage() {
  const lastUpdated = "March 2, 2026";

  const sections = [
    {
      icon: Building2,
      title: "Broker Eligibility & Account",
      content: [
        {
          subtitle: "Who May Register as a Broker",
          text: "Broker accounts are available to licensed yacht brokers, brokers, and brokerage companies (\"Broker\"). By registering as a Broker you represent that you are duly licensed where required by applicable law and that you have the legal authority to list and sell the vessels on your account."
        },
        {
          subtitle: "Accurate Business Information",
          text: "You agree to keep your company name, contact details, brokerage license numbers, and any other required business information current and accurate at all times. YachtVersal may request verification documents at any time, and failure to provide them may result in account suspension."
        },
        {
          subtitle: "Sales Representative Sub-Accounts",
          text: "You may invite sales representatives to operate under your broker account. You are fully responsible for all actions taken by team members operating under your account, and their activity is subject to the same restrictions that apply to you."
        },
        {
          subtitle: "Account Termination",
          text: "We reserve the right to suspend or terminate broker accounts that violate these terms, maintain inaccurate or fraudulent listings, or fail to honor inquiries in good faith. You may close your account at any time; pending subscription periods are non-refundable unless otherwise stated."
        }
      ]
    },
    {
      icon: FileText,
      title: "Listing Standards & Accuracy",
      content: [
        {
          subtitle: "Accuracy Requirement",
          text: "All listing information — including vessel specifications, asking price, condition, images, documents, and location — must be accurate and kept current. You are solely responsible for the accuracy of your listings. YachtVersal does not independently verify listing content."
        },
        {
          subtitle: "Authority to List",
          text: "By creating a listing, you represent that you have the legal authority to offer the vessel for sale (either as owner, authorized broker, or co-broker), that the vessel is available for sale, and that no conflicting listing rights exist."
        },
        {
          subtitle: "Pricing",
          text: "Listing prices must reflect genuine asking prices. Artificially low \"bait\" prices, price manipulation, or listings created solely to collect leads without genuine intent to sell are prohibited and may result in immediate account termination."
        },
        {
          subtitle: "Removal of Sold / Withdrawn Vessels",
          text: "You agree to promptly deactivate or remove any listing for a vessel that has been sold, taken off the market, or is otherwise no longer available. Repeatedly maintaining sold-vessel listings is a violation of these Terms."
        },
        {
          subtitle: "Legal Compliance",
          text: "All listings must comply with applicable federal, state, and local laws including those governing vessel sales, truth-in-advertising, and consumer protection."
        }
      ]
    },
    {
      icon: Globe,
      title: "Website Data Integration & Scraping Authorization",
      content: [
        {
          subtitle: "Optional Feature",
          text: "YachtVersal offers an optional data-import feature that allows you to connect your own website or listing feed so that your vessel inventory can be automatically synchronized with your YachtVersal listings. This feature is opt-in; you are not required to enable it."
        },
        {
          subtitle: "Your Express Authorization",
          text: "By enabling the website data import feature for a specific domain or URL, you expressly authorize YachtVersal and its designated service providers to programmatically access, crawl, parse, and extract vessel listing data from your public-facing web pages for the sole purpose of creating and updating inventory on the YachtVersal platform. This authorization covers your primary brokerage website and any explicitly added URLs you configure in your dashboard."
        },
        {
          subtitle: "Scope of Authorization",
          text: "The authorization above extends only to publicly accessible listing pages (i.e., pages accessible without authentication). YachtVersal will not attempt to access password-protected sections, administrative interfaces, or any data that is not intended for public viewing."
        },
        {
          subtitle: "Your Responsibility for Third-Party Rights",
          text: "If your website is built on a third-party platform (e.g., a CMS, listing aggregator, or MLS system), it is your responsibility to ensure you have the right to authorize scraping of that content. YachtVersal is not liable for any breach of a third-party platform's terms of service that arises from your grant of authorization."
        },
        {
          subtitle: "Revocation",
          text: "You may revoke this authorization at any time by disabling the website import feature in your dashboard. Upon revocation, YachtVersal will cease automated data collection from your website; previously imported data that you have not independently deleted from your YachtVersal listings will remain until you remove it."
        },
        {
          subtitle: "Data Accuracy",
          text: "YachtVersal does not guarantee the completeness or accuracy of data imported via scraping. You remain responsible for reviewing imported listings and correcting any errors. Imported data is treated the same as any other broker-submitted content under these Terms."
        }
      ]
    },
    {
      icon: Code2,
      title: "API Access & Third-Party Co-Brokering Rights",
      content: [
        {
          subtitle: "Platform API",
          text: "YachtVersal operates a public-facing API that allows authorized third parties — including other licensed yacht brokers and brokerage platforms — to access and display active listing data. By maintaining active listings on YachtVersal, you acknowledge and agree that your listing data (title, specifications, pricing, images, and location) may be accessed and displayed on third-party websites and applications that have been granted API access by YachtVersal."
        },
        {
          subtitle: "Co-Brokering Default",
          text: "Participation in third-party co-brokering through the API is enabled by default and is a core feature of the YachtVersal marketplace. Other licensed brokers who display your listings via the API are doing so in a co-brokering capacity and are expected to abide by the terms under which they were granted API access."
        },
        {
          subtitle: "Opt-Out Right",
          text: "If you do not wish for your listings to be accessible to third-party API consumers, you may opt out by enabling the \"Co-Brokering Opt-Out\" setting in your broker dashboard. When this setting is enabled, your listings will be excluded from all API responses to third-party consumers. Note that opting out may reduce your listing's visibility and reach."
        },
        {
          subtitle: "No Commission Guarantee",
          text: "YachtVersal does not guarantee, negotiate, or enforce co-brokering commission agreements between brokers and third-party brokers who display listings via the API. Any commission arrangements are solely between you and the displaying broker."
        },
        {
          subtitle: "Your Own API Keys",
          text: "You may generate personal API keys from your dashboard to access YachtVersal data programmatically for your own business purposes. You are responsible for keeping your API keys secure and for all activity that occurs using your keys. API keys must not be shared with unauthorized parties. YachtVersal reserves the right to revoke API keys that are used in violation of these Terms."
        },
        {
          subtitle: "Prohibited API Uses",
          text: "API access may not be used to: (a) bulk-export competitor listing data for commercialization; (b) build a directly competing marketplace; (c) circumvent subscription limitations; (d) overload YachtVersal infrastructure (rate limits apply); or (e) any purpose that violates applicable law."
        }
      ]
    },
    {
      icon: Image,
      title: "Media License & Marketing Rights",
      content: [
        {
          subtitle: "Your License Grant",
          text: "By uploading photographs, videos, 3D renderings, virtual tours, floor plans, or any other media to the YachtVersal platform (\"Broker Media\"), you grant YachtVersal a non-exclusive, worldwide, royalty-free, sublicensable, and perpetual license to use, reproduce, modify (e.g., crop, resize, watermark), distribute, publicly display, and publicly perform such Broker Media for the following purposes: (i) operating and displaying listings on the YachtVersal platform; (ii) marketing, advertising, and promotional materials in any medium, including digital advertising, social media posts, email campaigns, billboards, and print; (iii) press releases, media kits, blog content, and case studies; and (iv) product demonstrations, sales presentations, and trade show materials."
        },
        {
          subtitle: "Attribution",
          text: "YachtVersal will make commercially reasonable efforts to attribute Broker Media to your brokerage when used in marketing contexts where attribution is practical. However, attribution is not guaranteed in all contexts (e.g., programmatically generated ad formats, resized social thumbnails)."
        },
        {
          subtitle: "Your Warranties",
          text: "You represent and warrant that: (a) you own or have all necessary rights, licenses, and permissions to upload the Broker Media and to grant the license described above; (b) the Broker Media does not infringe the intellectual property rights, privacy rights, or any other rights of any third party; and (c) persons depicted in media have provided any required consent."
        },
        {
          subtitle: "Post-Termination Use",
          text: "Upon termination or expiration of your broker account, YachtVersal may continue to use Broker Media in existing published marketing materials (e.g., blog posts, case studies, ad campaigns already in distribution) for up to eighteen (18) months following termination. After that period, YachtVersal will remove Broker Media from ongoing use in new marketing materials, though cached or archived copies may remain. Media associated with active listings on the platform (where co-brokering applies) may be retained for the listing's lifetime."
        },
        {
          subtitle: "No Compensation",
          text: "The license granted above is provided without additional compensation beyond the services you receive as a platform subscriber. You acknowledge that the marketing exposure generated by YachtVersal's use of Broker Media constitutes reasonable consideration."
        }
      ]
    },
    {
      icon: Share2,
      title: "Co-Brokering Program",
      content: [
        {
          subtitle: "What Is Co-Brokering",
          text: "YachtVersal's co-brokering program allows other licensed brokers on the platform to display and market your listings to their own buyer networks, both through the YachtVersal platform and via the API."
        },
        {
          subtitle: "Default Participation",
          text: "All active broker listings are included in the co-brokering program by default. This is designed to maximize listing exposure and buyer reach."
        },
        {
          subtitle: "Opting Out",
          text: "You may disable co-brokering for your account at any time through the Preferences section of your broker dashboard. Opting out removes your listings from co-brokering queries. Re-enabling is also available at any time."
        },
        {
          subtitle: "Co-Broker Responsibilities",
          text: "Brokers who display co-brokered listings are expected to present listing information accurately and direct buyer inquiries through YachtVersal's messaging system. They may not alter pricing, specifications, or contact information in their display."
        }
      ]
    },
    {
      icon: DollarSign,
      title: "Subscription, Billing & Fees",
      content: [
        {
          subtitle: "Subscription Plans",
          text: "Broker accounts require a paid subscription. Plan features (number of listings, images, team seats, etc.) are defined on the pricing page and may change with at least 30 days' written notice to existing subscribers."
        },
        {
          subtitle: "Billing & Auto-Renewal",
          text: "Subscriptions are billed on a monthly or annual basis in advance. Subscriptions auto-renew at the end of each billing period unless you cancel before the renewal date. Payment is processed via Stripe. You agree to keep a valid payment method on file."
        },
        {
          subtitle: "Price Changes",
          text: "YachtVersal may adjust subscription pricing. We will notify you by email at least 30 days before a price change takes effect. Your continued use after the change constitutes acceptance."
        },
        {
          subtitle: "Cancellation & Refunds",
          text: "You may cancel your subscription at any time through your dashboard or by contacting support. Cancellation removes access at the end of the current billing period. Subscription fees are non-refundable unless otherwise required by applicable law or expressly agreed in writing."
        },
        {
          subtitle: "Taxes",
          text: "Subscription fees are exclusive of applicable taxes. You are responsible for any taxes, levies, or duties imposed by tax authorities on your subscription, except for taxes on YachtVersal's net income."
        }
      ]
    },
    {
      icon: Star,
      title: "Featured Listings",
      content: [
        {
          subtitle: "What Is Featured",
          text: "YachtVersal offers featured placement as an optional paid service that increases a listing's prominence in search results, on listing pages, and in other platform surfaces."
        },
        {
          subtitle: "No Guarantee of Impressions or Position",
          text: "Featured status improves visibility but does not guarantee a specific position, number of impressions, clicks, or inquiries. Placement is subject to platform algorithms, competing featured listings, and search context."
        },
        {
          subtitle: "Not an Endorsement",
          text: "Featured placement is a paid marketing service and does not constitute YachtVersal's endorsement, verification, or recommendation of a vessel or broker."
        },
        {
          subtitle: "Compliance",
          text: "Featured listings are subject to all listing standards in Section 2. YachtVersal reserves the right to remove featured status (without refund) from listings found to violate the accuracy or prohibited-conduct requirements."
        }
      ]
    },
    {
      icon: Wrench,
      title: "Bulk Data Tools",
      content: [
        {
          subtitle: "Bulk Upload & Management",
          text: "YachtVersal provides bulk listing tools to allow brokers to create or update multiple listings simultaneously. Use of bulk tools for the purpose of creating spam listings, manipulating search rankings, or flooding the platform with inaccurate data is a material breach of these Terms and may result in immediate account termination."
        },
        {
          subtitle: "Accuracy of Bulk-Submitted Data",
          text: "You are responsible for verifying bulk-submitted listing data before publication. YachtVersal is not responsible for errors introduced through file formatting issues, incorrect data mapping, or malformed uploads."
        },
        {
          subtitle: "Rate Limits",
          text: "Bulk operations are subject to rate limits to protect platform stability. Exceeding these limits may result in temporary throttling or suspension of bulk tool access."
        }
      ]
    },
    {
      icon: Users,
      title: "Team Accounts & Sales Representatives",
      content: [
        {
          subtitle: "Broker Admin Responsibility",
          text: "As the broker account holder, you are the \"Broker Admin\" and bear full legal responsibility for all activity conducted by team members and sales representatives operating under your account, regardless of whether you authorized the specific actions."
        },
        {
          subtitle: "Team Member Data",
          text: "When you invite team members, their name, email address, and role are collected and stored as part of your account data. Team members are individual users bound by the General Terms & Conditions in addition to operating within your broker account."
        },
        {
          subtitle: "Revoking Access",
          text: "You may revoke a team member's access at any time through Team Settings. Upon revocation, the team member loses access to your broker account immediately."
        },
        {
          subtitle: "Salesman Profiles",
          text: "Sales representative profiles are public-facing and may include name, photo, contact details, and license information. Team members consent to this public display by accepting their invitation."
        }
      ]
    },
    {
      icon: ShieldAlert,
      title: "Prohibited Broker Conduct",
      content: [
        {
          subtitle: "Fraudulent Listings",
          text: "Creating listings for vessels you do not have the right to sell, fictitious vessels, or vessels with materially misrepresented information is strictly prohibited. Fraudulent listings will be removed immediately and may result in permanent account termination and reporting to relevant authorities."
        },
        {
          subtitle: "Lead Misuse",
          text: "Buyer inquiries and contact information received through YachtVersal may only be used to respond to the specific inquiry and for legitimate follow-up regarding the relevant listing. You may not add buyer contact details to third-party mailing lists or sell them."
        },
        {
          subtitle: "Off-Platform Circumvention",
          text: "Actively encouraging buyers to circumvent YachtVersal exclusively to avoid platform activity (while continuing to benefit from the platform for lead generation) is a violation of these Terms."
        },
        {
          subtitle: "Competitor Intelligence Harvesting",
          text: "Using the platform, the API, or any data obtained from YachtVersal to build datasets for the primary purpose of commercial resale, competitor analysis products, or training competing AI models is prohibited without written consent."
        }
      ]
    },
    {
      icon: Shield,
      title: "Indemnification",
      content: [
        {
          subtitle: "Broker Indemnification",
          text: "You agree to indemnify, defend, and hold harmless YachtVersal, its officers, directors, employees, agents, and licensors from and against any claims, liabilities, damages, judgments, awards, losses, and expenses (including reasonable attorneys' fees) arising out of: (a) your listing content; (b) your breach of these Terms; (c) your violation of any applicable law; (d) third-party claims that content you uploaded infringes their intellectual property or other rights; (e) inaccuracies in vessel representations; or (f) any buyer dispute related to a transaction initiated through the platform."
        }
      ]
    },
    {
      icon: Scale,
      title: "Term, Termination & Survival",
      content: [
        {
          subtitle: "Term",
          text: "This Agreement is effective from the date you accept it and continues until your broker account is terminated."
        },
        {
          subtitle: "Termination by YachtVersal",
          text: "We may terminate this Agreement and your broker account immediately upon notice for material breach, fraud, non-payment, or conduct that harms the platform or other users."
        },
        {
          subtitle: "Effect of Termination",
          text: "Upon termination: your listings will be deactivated; your API keys will be revoked; your team member accounts will lose broker-account access. Sections on media licensing (during the 18-month wind-down), indemnification, intellectual property, disclaimers, limitation of liability, and governing law survive termination."
        },
        {
          subtitle: "Data Retrieval",
          text: "Following termination you have 30 days to export your listing data through your dashboard before it is permanently deleted, subject to YachtVersal's data retention obligations under applicable law."
        }
      ]
    },
    {
      icon: CreditCard,
      title: "Refund & Cancellation Policy",
      content: [
        {
          subtitle: "Refund Policy",
          text: "YachtVersal customers agree not to submit chargebacks to their bank. Refunds will not be accepted through credit card chargebacks. All sales are final. For refund requests, please email us at info@yachtversal.com. Refunds will be processed within 48 hours of acknowledged receipt of request."
        },
        {
          subtitle: "Cancellation Policy",
          text: "All cancellation requests must be submitted directly to YachtVersal. We require a minimum of two (2) weeks\u2019 notice prior to the scheduled service date for any cancellation requests. To initiate a cancellation, please contact us via email at info@yachtversal.com."
        },
        {
          subtitle: "No Chargebacks",
          text: "By using YachtVersal\u2019s paid services, you expressly agree not to dispute or chargeback any charges through your financial institution. Unauthorized chargebacks will be disputed and may result in account suspension."
        }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-soft to-white">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-[#10214F] via-[#10214F] to-[#1a3270] py-20 border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Link
            href="/terms"
            className="inline-flex items-center gap-2 text-white/60 hover:text-white text-sm mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to General Terms
          </Link>
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/10 border-2 border-white/20 mb-6">
            <Building2 className="w-10 h-10 text-[#01BBDC]" />
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            Broker Services Agreement
          </h1>
          <p className="text-xl text-white/70 mb-6">
            This agreement governs your use of YachtVersal as a professional broker or broker. It supplements — and must be read alongside — our General Terms & Conditions and Privacy Policy.
          </p>
          <p className="text-sm text-white/50">
            Last Updated: <span className="font-semibold text-white/70">{lastUpdated}</span>
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Introduction */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 mb-10">
            <h2 className="text-2xl font-bold text-secondary mb-4">About This Agreement</h2>
            <div className="space-y-4 text-dark leading-relaxed">
              <p>
                This Broker Services Agreement ("Broker Agreement") is a binding legal contract between you (the "Broker") and YachtVersal governing your use of the platform as a professional yacht broker or seller.
              </p>
              <p>
                This Broker Agreement incorporates by reference the{' '}
                <Link href="/terms" className="text-primary underline">General Terms & Conditions</Link> and the{' '}
                <Link href="/privacy" className="text-primary underline">Privacy Policy</Link>.
                In the event of a conflict between this Broker Agreement and the General Terms, this Broker Agreement governs with respect to broker-specific matters.
              </p>
              <p>
                By registering a broker account, checking the acceptance checkbox during registration, or continuing to use a broker account after these terms are posted, you agree to be bound by this Broker Agreement.
              </p>
            </div>
          </div>

          {/* Key consents callout */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
            {[
              { icon: Globe, label: 'Website Scraping', desc: 'Opt-in authorization for data import from your site', color: '#10214F' },
              { icon: Code2, label: 'API Co-Brokering', desc: 'Listings accessible to third-party brokers via API', color: '#01BBDC' },
              { icon: Image, label: 'Media Rights', desc: 'License for photos & videos in marketing materials', color: '#10214F' },
            ].map(({ icon: Icon, label, desc, color }) => (
              <div key={label} className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col gap-2">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-1"
                  style={{ backgroundColor: `${color}18` }}
                >
                  <Icon className="w-5 h-5" style={{ color }} />
                </div>
                <p className="font-bold text-secondary text-sm">{label}</p>
                <p className="text-gray-500 text-xs leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          {/* Main Sections */}
          <div className="space-y-10">
            {sections.map((section, idx) => (
              <div key={idx} className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-6 border-b border-gray-200">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center">
                      <section.icon className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-primary/60 uppercase tracking-wider mb-0.5">Section {idx + 1}</p>
                      <h2 className="text-2xl font-bold text-secondary">{section.title}</h2>
                    </div>
                  </div>
                </div>
                <div className="p-8 space-y-6">
                  {section.content.map((item, itemIdx) => (
                    <div key={itemIdx}>
                      <h3 className="text-base font-semibold text-gray-900 mb-2">
                        {idx + 1}.{itemIdx + 1} &nbsp;{item.subtitle}
                      </h3>
                      <p className="text-gray-700 leading-relaxed text-sm">
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
            <div className="space-y-4 text-dark leading-relaxed text-sm">
              <p>
                This Broker Agreement shall be governed by the laws of the State of Florida, United States, without regard to its conflict-of-law provisions.
              </p>
              <p>
                Disputes arising under this Agreement that cannot be resolved informally shall be submitted to binding arbitration under the rules of the American Arbitration Association, conducted in Florida. Each party waives the right to a jury trial and to participate in any class or representative proceeding.
              </p>
              <p>
                Notwithstanding the above, either party may seek injunctive or other equitable relief in any court of competent jurisdiction to prevent the actual or threatened infringement, misappropriation, or violation of intellectual property rights or confidential information.
              </p>
            </div>
          </div>

          {/* Modifications */}
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 mt-8">
            <h2 className="text-2xl font-bold text-secondary mb-4">Modifications to This Agreement</h2>
            <p className="text-dark leading-relaxed text-sm">
              YachtVersal reserves the right to update this Broker Agreement at any time. We will notify you of material changes by email to your registered address at least 30 days before the new terms take effect. Your continued use of the platform after the effective date constitutes acceptance.
            </p>
          </div>

          {/* Entire Agreement */}
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-8 mt-8">
            <h2 className="text-2xl font-bold text-secondary mb-4">Entire Agreement</h2>
            <p className="text-dark leading-relaxed text-sm">
              This Broker Agreement, together with the General Terms & Conditions and Privacy Policy, constitutes the entire agreement between you and YachtVersal with respect to your broker account and supersedes all prior negotiations, understandings, and agreements, whether written or oral. Any order forms or specific addenda signed with YachtVersal also form part of this agreement.
            </p>
          </div>

          {/* Contact Section */}
          <div className="bg-[#10214F] rounded-2xl p-8 mt-8">
            <h2 className="text-2xl font-bold text-white mb-4">Questions About This Agreement?</h2>
            <p className="text-white/70 leading-relaxed mb-4 text-sm">
              If you have questions about this Broker Services Agreement or wish to discuss specific terms, please contact us:
            </p>
            <div className="space-y-2 text-white/80 text-sm">
              <p><strong className="text-white">Email:</strong> info@yachtversal.com</p>
            </div>
          </div>

          {/* Back to General Terms */}
          <div className="mt-8 text-center">
            <Link
              href="/terms"
              className="inline-flex items-center gap-2 text-primary hover:text-primary/80 text-sm font-medium transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Back to General Terms & Conditions
            </Link>
          </div>

        </div>
      </section>
    </div>
  );
}
