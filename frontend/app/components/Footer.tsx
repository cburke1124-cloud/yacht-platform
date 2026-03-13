import Link from 'next/link';
import Image from 'next/image';
import { Facebook, Instagram, Linkedin, Mail } from 'lucide-react';

export default function Footer() {
  const mainLinks = [
    { href: '/listings', label: 'Search Listings' },
    { href: '/sell/brokers', label: 'Yacht Brokers' },
    { href: '/sell/private', label: 'Private Sellers' },
  ];

  const resources = [
    { href: '/resources/how-buying-works', label: 'How Buying Works' },
    { href: '/resources/financing', label: 'Financing' },
    { href: '/contact', label: 'Contact' },
  ];

  const socialLinks = [
    { href: 'https://www.facebook.com/profile.php?id=61579522401665', icon: Facebook, label: 'Facebook' },
    { href: 'https://www.instagram.com/yachtversal/', icon: Instagram, label: 'Instagram' },
    { href: 'https://www.linkedin.com/company/112766298/admin/dashboard/', icon: Linkedin, label: 'LinkedIn' },
  ];

  return (
    <footer className="relative overflow-hidden bg-secondary text-light">
      <div className="pointer-events-none absolute right-0 top-10 hidden opacity-20 lg:block">
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
                width={260}
                height={70}
                className="h-auto w-[260px]"
                style={{ filter: 'drop-shadow(0 0 8px rgba(1,187,220,0.45))' }}
              />
            </div>
            <p className="max-w-[303px] text-base leading-6 text-light/90">
              A smarter way to buy and sell yachts. Connecting buyers and sellers in a trusted marketplace.
            </p>
          </div>

          <div>
            <h3 className="mb-4 text-[22px] font-normal leading-7 text-primary">Quick Links</h3>
            <ul className="space-y-0 text-base leading-10">
              {mainLinks.map((item) => (
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
              href="mailto:info@yachtversal.com"
              className="inline-flex items-center gap-2 text-base leading-6 text-light transition-colors hover:text-primary"
            >
              <Mail size={16} />
              info@yachtversal.com
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