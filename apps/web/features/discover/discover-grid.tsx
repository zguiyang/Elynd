'use client';

import { DiscoverBookCard } from '@/features/discover/discover-book-card';
import type { DiscoverItem, DiscoverShelfStatus } from '@/features/discover/discover-mock';

type DiscoverGridProps = {
  items: DiscoverItem[];
  shelfOverrides: Record<string, DiscoverShelfStatus>;
  onAddToShelf: (id: string) => void;
};

export function DiscoverGrid({ items, shelfOverrides, onAddToShelf }: DiscoverGridProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-3">
      {items.map((item) => {
        const shelfStatus = shelfOverrides[item.id] ?? item.shelfStatus;
        return <DiscoverBookCard key={item.id} item={item} shelfStatus={shelfStatus} onAddToShelf={onAddToShelf} />;
      })}
    </div>
  );
}
