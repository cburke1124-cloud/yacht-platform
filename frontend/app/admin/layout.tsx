import { ReactNode } from 'react';

export default function AdminRootLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Admin pages use their own layout (AdminLayout component)
  // This prevents the main Navbar and Footer from appearing
  return <>{children}</>;
}
