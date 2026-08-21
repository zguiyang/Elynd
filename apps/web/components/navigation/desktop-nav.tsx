'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { matchesNavPath, NAV_COPY, PRIMARY_NAV_LINKS } from '@/components/navigation/nav-config';

type DesktopNavProps = {
  onOpenSettings: () => void;
};

export function DesktopNav({ onOpenSettings }: DesktopNavProps) {
  const pathname = usePathname() ?? '/';

  return (
    <div className="flex items-center gap-8">
      {PRIMARY_NAV_LINKS.map((item) => {
        const isActive = matchesNavPath(pathname, item.href);
        return (
          <Link key={item.id} href={item.href} aria-current={isActive ? 'page' : undefined} className="site-nav-link">
            {item.label}
          </Link>
        );
      })}
      <button type="button" onClick={onOpenSettings} className="site-nav-link">
        {NAV_COPY.settings}
      </button>
    </div>
  );
}
