'use client';

import { coverTintForVolume } from '@/features/content/content-model';

type BookDetailCoverProps = {
  title: string;
  tags: string[];
  className?: string;
};

export function BookDetailCover({ title, tags, className }: BookDetailCoverProps) {
  const tint = coverTintForVolume(tags, title);

  return (
    <div className={`relative overflow-hidden shadow-card ring-1 ring-foreground/5 ${tint} ${className ?? ''}`}>
      <div className="absolute inset-0 flex flex-col justify-between p-4 md:p-6">
        <span className="self-end rounded-sm border border-border/30 bg-background/95 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-foreground shadow-sm">
          官方
        </span>
        <p className="font-heading line-clamp-4 text-sm font-bold leading-snug text-foreground/85 md:text-lg">
          {title}
        </p>
      </div>
    </div>
  );
}
