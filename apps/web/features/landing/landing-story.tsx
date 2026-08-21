import { CheckIcon, MinusIcon } from 'lucide-react';
import Image from 'next/image';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { landingCopy as c } from '@/features/landing/landing-copy';
import { LandingSection } from '@/features/landing/landing-section';
import { cn } from '@/lib/utils';

function ContrastCard({ title, items, tone }: { title: string; items: readonly string[]; tone: 'past' | 'next' }) {
  const Icon = tone === 'next' ? CheckIcon : MinusIcon;
  return (
    <Card className={cn('relative overflow-hidden rounded-3xl py-0 shadow-card', tone === 'next' && 'ring-primary/30')}>
      {tone === 'next' ? (
        <div className="pointer-events-none absolute -top-16 -right-16 size-32 rounded-bl-full bg-primary/5" />
      ) : null}
      <CardHeader className="px-10 pt-10 md:px-12 md:pt-12">
        <CardTitle
          className={cn(
            'font-heading text-xl font-semibold md:text-2xl',
            tone === 'next' ? 'text-primary' : 'text-muted-foreground',
          )}
        >
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-10 pb-10 md:px-12 md:pb-12">
        <ul className="flex flex-col gap-6">
          {items.map((item) => (
            <li key={item} className="font-reading flex items-start gap-3 text-lg leading-relaxed">
              <Icon
                className={cn('mt-1 size-5 shrink-0', tone === 'next' ? 'text-primary' : 'text-outline/70')}
                strokeWidth={1.5}
                aria-hidden
              />
              <span className={tone === 'next' ? 'text-foreground' : 'text-muted-foreground'}>{item}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function LandingStory() {
  return (
    <>
      <LandingSection id="origin">
        <div className="grid items-center gap-12 md:grid-cols-2 md:gap-16">
          <div className="relative order-1 aspect-[4/3] overflow-hidden rounded-2xl shadow-card ring-1 ring-border/20 md:order-2">
            <Image
              src="/landing/origin.jpg"
              alt={c.origin.imageAlt}
              fill
              className="object-cover"
              sizes="(min-width: 768px) 32rem, 100vw"
            />
          </div>
          <div className="order-2 md:order-1">
            <h2 className="font-heading text-3xl leading-tight font-semibold tracking-tight md:text-4xl">
              {c.origin.title}
            </h2>
            <div className="font-reading mt-8 flex flex-col gap-6 text-lg leading-8 text-foreground/80">
              {c.origin.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </div>
        </div>
      </LandingSection>

      <LandingSection id="contrast" tone="paper">
        <h2 className="font-heading mx-auto max-w-3xl text-center text-3xl leading-tight font-semibold tracking-tight md:text-4xl">
          {c.contrast.title}
        </h2>
        <div className="mx-auto mt-16 grid max-w-5xl gap-8 md:grid-cols-2">
          <ContrastCard title={c.contrast.pastTitle} items={c.contrast.pastItems} tone="past" />
          <ContrastCard title={c.contrast.nextTitle} items={c.contrast.nextItems} tone="next" />
        </div>
        <p className="font-reading mx-auto mt-16 max-w-2xl text-center text-lg font-semibold text-foreground/80">
          {c.contrast.punch}
        </p>
      </LandingSection>

      <LandingSection id="philosophy">
        <div className="text-center">
          <h2 className="font-heading text-4xl leading-tight font-bold tracking-tight md:text-[56px] md:leading-[64px]">
            {c.philosophy.title}
          </h2>
          <p className="font-reading mx-auto mt-8 max-w-3xl text-xl leading-relaxed text-muted-foreground md:text-2xl">
            {c.philosophy.lead}
          </p>
          <p className="mt-4 text-lg text-muted-foreground/70">{c.philosophy.leadZh}</p>
        </div>
        <div className="mx-auto mt-16 grid max-w-5xl gap-12 border-t border-border/70 pt-16 text-left md:grid-cols-3">
          {c.philosophy.items.map((item) => (
            <div key={item.title}>
              <h3 className="font-heading text-xl font-semibold text-primary md:text-2xl">{item.title}</h3>
              <p className="font-reading mt-3 text-lg leading-relaxed text-foreground/80">{item.body}</p>
            </div>
          ))}
        </div>
      </LandingSection>
    </>
  );
}
