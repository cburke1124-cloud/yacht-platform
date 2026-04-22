'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

type LayoutShellProps = {
  navbar: ReactNode;
  footer: ReactNode;
  children: ReactNode;
};

export default function LayoutShell({ navbar, footer, children }: LayoutShellProps) {
  const pathname = usePathname();
  const hideChrome = false; // homepage is now the full site — always show nav/footer

  return (
    <>
      {!hideChrome && navbar}
      {children}
      {!hideChrome && footer}
    </>
  );
}
