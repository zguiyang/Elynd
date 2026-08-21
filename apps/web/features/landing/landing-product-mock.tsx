import { SparklesIcon } from 'lucide-react';
import Image from 'next/image';

import { landingCopy as c } from '@/features/landing/landing-copy';

export function LandingFrameImage({ src, alt, priority = false }: { src: string; alt: string; priority?: boolean }) {
  return (
    <div className="relative aspect-[16/10] overflow-hidden rounded-2xl shadow-card ring-1 ring-border/20">
      <Image
        src={src}
        alt={alt}
        fill
        className="object-cover object-top"
        sizes="(min-width: 768px) 32rem, 100vw"
        priority={priority}
      />
    </div>
  );
}

export function LandingCompanionCard() {
  return (
    <div className="rounded-3xl bg-background p-8 shadow-card ring-1 ring-border/40 md:p-10">
      <div className="flex gap-6">
        <SparklesIcon className="size-8 shrink-0 text-primary" strokeWidth={1.5} aria-hidden />
        <div>
          <h4 className="text-lg font-semibold">{c.product.companion.cardTitle}</h4>
          <p className="mt-2 leading-relaxed text-muted-foreground">{c.product.companion.cardBody}</p>
        </div>
      </div>
    </div>
  );
}
