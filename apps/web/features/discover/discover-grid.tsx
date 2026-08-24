'use client';

import { DiscoverBookCard } from '@/features/discover/discover-book-card';
import type { DiscoverItem } from '@/features/discover/discover-model';

type DiscoverGridProps = {
  items: DiscoverItem[];
  onAddToShelf: (id: string) => void;
  addingId?: string;
};

export function DiscoverGrid({ items, onAddToShelf, addingId }: DiscoverGridProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-8 lg:grid-cols-3">
      {items.map((item) => (
        <DiscoverBookCard key={item.id} item={item} onAddToShelf={onAddToShelf} addingId={addingId} />
      ))}
    </div>
  );
}
