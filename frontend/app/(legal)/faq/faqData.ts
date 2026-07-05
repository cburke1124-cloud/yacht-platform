// Shared FAQ content — imported by both the server page (for FAQPage JSON-LD)
// and the client accordion. Answers must stay plain strings so they can be
// serialized into structured data; related links render separately below each
// answer.

export interface FaqQuestion {
  q: string;
  a: string;
  links?: Array<{ label: string; href: string }>;
}

export interface FaqCategory {
  category: string;
  questions: FaqQuestion[];
}

export const FAQ_ITEMS: FaqCategory[] = [
  {
    category: 'Buying',
    questions: [
      {
        q: 'How do I search for yachts for sale on YachtVersal?',
        a: 'Browse all yachts for sale on our listings page, where you can filter by boat type, make, model, price, length, year, condition, and location. You can also use our AI-powered search to describe your ideal boat in plain English — for example, "a family catamaran under $1M for coastal cruising" — and get matched results instantly.',
        links: [
          { label: 'Browse yachts for sale', href: '/listings' },
          { label: 'Try AI search', href: '/ai-search' },
        ],
      },
      {
        q: 'Are the listings and brokers verified?',
        a: 'Brokers on YachtVersal go through a verification process, and verified brokers display a Verified badge on their profile and listings. As with any major purchase, we recommend buyers complete their own due diligence — including a marine survey and sea trial — before buying. YachtVersal is a marketplace platform that connects buyers directly with sellers.',
      },
      {
        q: 'How do I contact a seller about a yacht?',
        a: 'Open any listing and use the Contact Broker button to message the seller directly. You do not need an account to send an inquiry, though a free buyer account lets you save yachts, build comparisons, and set price alerts.',
      },
      {
        q: 'Can I save and compare yachts?',
        a: 'Yes. With a free buyer account you can save unlimited listings, build side-by-side comparisons, and set price alerts that email you when a yacht’s price changes.',
      },
      {
        q: 'Does YachtVersal offer financing tools?',
        a: 'Every listing includes a built-in finance calculator that estimates monthly payments based on your down payment, loan term, and interest rate. Our financing guide explains how marine lending works and what to expect during the loan process.',
        links: [{ label: 'Yacht financing guide', href: '/resources/financing' }],
      },
      {
        q: 'How do I know which type of boat is right for me?',
        a: 'Our boat types guide explains what each category — motor yachts, sailing yachts, catamarans, trawlers, sport fishers, and more — is built for, who it suits best, and which builders make it. You can also browse boats by make to compare builders and their model ranges.',
        links: [
          { label: 'Explore boat types', href: '/boat-types' },
          { label: 'Browse makes', href: '/makes' },
        ],
      },
    ],
  },
  {
    category: 'Chartering',
    questions: [
      {
        q: 'Can I charter a yacht through YachtVersal?',
        a: 'Yes. Our charter section lists yachts available for charter with day and weekly rates, crew details, guest capacity, and operating regions. You can filter charters by destination, boat type, and dates.',
        links: [{ label: 'Browse charters', href: '/charter' }],
      },
      {
        q: 'Where can I charter a yacht?',
        a: 'Our charter destinations guide covers popular cruising regions such as the Caribbean, with local sailing conditions, what to expect in each area, and the yachts currently available there.',
        links: [{ label: 'Charter destinations', href: '/charter-destinations' }],
      },
    ],
  },
  {
    category: 'Selling & Listing',
    questions: [
      {
        q: 'How do I list my yacht for sale?',
        a: 'Yacht brokers can create an account and start listing immediately. Private sellers can list through our private seller plans. Listings support unlimited photos, video, PDF documents such as spec sheets and surveys, and full specifications.',
        links: [
          { label: 'For yacht brokers', href: '/sell/brokers' },
          { label: 'For private sellers', href: '/sell/private' },
        ],
      },
      {
        q: 'What is the AI listing import feature?',
        a: 'Our AI import tool can automatically bring in yacht listings from your existing website. Provide the URL, and the AI extracts specifications, descriptions, and images, creating a complete listing in seconds instead of retyping everything by hand.',
      },
      {
        q: 'Can I manage multiple sales representatives?',
        a: 'Yes. Brokerages can add sales representatives with customizable permissions. Each rep manages their own listings and leads while the brokerage keeps oversight through a shared dashboard.',
      },
      {
        q: 'How do leads work?',
        a: 'When a buyer inquires about your listing, you receive a lead notification with their contact details. Leads are tracked in your dashboard with timestamps, contact history, and follow-up reminders.',
      },
      {
        q: 'Can I feature my listings?',
        a: 'Yes. Featured listings appear prominently in search results and on the homepage carousel, giving them significantly more visibility than standard placements.',
      },
    ],
  },
  {
    category: 'Pricing & Plans',
    questions: [
      {
        q: 'How much does YachtVersal cost for buyers?',
        a: 'Nothing. Browsing, searching, saving yachts, building comparisons, setting price alerts, and contacting sellers are all free for buyers.',
      },
      {
        q: 'How much does it cost to list a yacht?',
        a: 'Yacht brokers pay a one-time $199 setup fee with full platform access from day one, including unlimited active listings. Private seller plans are also available. See our broker and private seller pages for current details.',
        links: [
          { label: 'Broker pricing', href: '/register' },
          { label: 'Private seller plans', href: '/sell/private' },
        ],
      },
      {
        q: 'Are there any transaction fees or commissions?',
        a: 'No. YachtVersal does not charge transaction fees or commissions on sales. All transactions are directly between the buyer and the seller.',
      },
    ],
  },
  {
    category: 'Security & Trust',
    questions: [
      {
        q: 'How is my data protected?',
        a: 'All traffic is encrypted with SSL/TLS, sessions use secure httpOnly cookies, and broker and admin accounts are protected with mandatory two-factor authentication. Payments are processed by Stripe — we never store card details on our servers.',
      },
      {
        q: 'How do you verify brokers?',
        a: 'Brokers complete a verification process, including business documentation and identity checks, before receiving the Verified badge. Verified status is displayed on broker profiles and their listings so buyers know who they are dealing with.',
      },
      {
        q: 'What media can listings include?',
        a: 'Listings support high-resolution photos (JPG, PNG, and WebP), YouTube and Vimeo video embeds, and PDF documents such as spec sheets, brochures, and survey reports.',
      },
    ],
  },
];
