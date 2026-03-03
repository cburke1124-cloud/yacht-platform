import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Contact Us | YachtVersal',
  description: 'Get in touch with the YachtVersal team. Questions about buying, selling, or listing a yacht? We\'re here to help.',
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
