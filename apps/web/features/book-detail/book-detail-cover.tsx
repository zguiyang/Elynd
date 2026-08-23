import { coverTintForVolume } from '@/features/content/content-model';
import { cn } from '@/lib/utils';

type BookDetailCoverProps = {
  title: string;
  themes: string[];
  className?: string;
};

export function BookDetailCover({ title, themes, className }: BookDetailCoverProps) {
  const tint = coverTintForVolume(themes, title);

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-l-md rounded-r-xl shadow-card ring-1 ring-foreground/8',
        'transition-transform duration-300 ease-out-soft motion-safe:hover:scale-[1.015]',
        tint,
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-y-0 left-0 z-10 w-1.5 bg-gradient-to-r from-foreground/15 to-transparent"
        aria-hidden
      />
      <div className="absolute inset-0 flex flex-col justify-between p-4 md:p-5">
        <span className="self-end rounded-sm border border-border/30 bg-background/95 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-foreground shadow-sm">
          官方
        </span>
        <p className="font-heading line-clamp-5 text-base font-bold leading-snug text-foreground/85 md:text-xl">
          {title}
        </p>
      </div>
    </div>
  );
}
