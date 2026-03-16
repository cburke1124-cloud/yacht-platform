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
  const hideChrome = pathname === '/';

  return (
    <>
      {!hideChrome && navbar}
      {children}
      {!hideChrome && footer}
    </>
  );
}
