import Link from 'next/link';
import Image from 'next/image';
import { Facebook, Twitter, Instagram, Linkedin, Mail } from 'lucide-react';

export default function Footer() {
  const quickLinks = [
    { href: '/listings', label: 'Search Listings' },
    { href: '/sell-list', label: 'List Your Yacht' },
    { href: '/how-it-works', label: 'Buying Guide' },
    { href: '/how-it-works', label: 'Selling Guide' },
  ];

  const resources = [
    { href: '/about', label: 'About Us' },
    { href: '/blog', label: 'Blog' },
    { href: '/faq', label: 'FAQ' },
    { href: '/contact', label: 'Contact' },
  ];

  const socialLinks = [
    { href: 'https://facebook.com', icon: Facebook, label: 'Facebook' },
    { href: 'https://instagram.com', icon: Instagram, label: 'Instagram' },
    { href: 'https://twitter.com', icon: Twitter, label: 'Twitter' },
    { href: 'https://linkedin.com', icon: Linkedin, label: 'LinkedIn' },
  ];

  return (
    <footer className="relative overflow-hidden bg-secondary text-light">
      <div className="pointer-events-none absolute right-0 top-10 hidden opacity-10 lg:block">
        <Image
          src="/logo/footer-watermark.png"
          alt=""
          width={428}
          height={391}
          className="h-auto w-[360px] xl:w-[428px]"
        />
      </div>

      <div className="relative mx-auto max-w-[1296px] px-4 pb-8 pt-20 sm:px-6 lg:px-8">
        <div className="mb-10 grid grid-cols-1 gap-12 md:grid-cols-4 md:gap-10">
          <div>
            <div className="mb-6">
              <Image
                src="/logo/logo-two-tone-white.png"
                alt="YachtVersal"
                width={170}
                height={32}
                className="h-auto w-[170px]"
              />
            </div>
            <p className="max-w-[303px] text-base leading-6 text-light/90">
              A smarter way to buy and sell yachts. Connecting buyers and sellers in a trusted marketplace.
            </p>
          </div>

          <div>
            <h3 className="mb-4 text-[22px] font-normal leading-7 text-primary">Quick Links</h3>
            <ul className="space-y-0 text-base leading-10">
              {quickLinks.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="text-light transition-colors hover:text-primary">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-[22px] font-normal leading-7 text-primary">Resources</h3>
            <ul className="space-y-0 text-base leading-10">
              {resources.map((item) => (
                <li key={item.label}>
                  <Link href={item.href} className="text-light transition-colors hover:text-primary">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="mb-4 text-[22px] font-normal leading-7 text-primary">Connect</h3>
            <div className="mb-6 flex gap-3">
              {socialLinks.map((item) => {
                const Icon = item.icon;

                return (
                  <a
                    key={item.label}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={item.label}
                    className="flex h-[42px] w-[42px] items-center justify-center rounded-full border border-white bg-secondary text-primary transition-colors hover:border-white hover:bg-light/10"
                  >
                    <Icon size={18} />
                  </a>
                );
              })}
            </div>

            <a
              href="mailto:support@yachtversal.com"
              className="inline-flex items-center gap-2 text-base leading-6 text-light transition-colors hover:text-primary"
            >
              <Mail size={16} />
              support@yachtversal.com
            </a>
          </div>
        </div>

        <div className="border-t border-light/10 pt-8">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <p className="text-base leading-6 text-light">
              © {new Date().getFullYear()} YachtVersal. All rights reserved.
            </p>
            <div className="flex items-center gap-4 text-base leading-6">
              <Link href="/privacy" className="text-light transition-colors hover:text-primary">
                Privacy Policy
              </Link>
              <span className="text-light/50">|</span>
              <Link href="/terms" className="text-light transition-colors hover:text-primary">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}