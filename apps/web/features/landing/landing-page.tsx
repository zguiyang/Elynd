import Link from 'next/link';
import type { ReactNode } from 'react';

import { BrandMark } from '@/components/brand-mark';
import { Button } from '@/components/ui/button';
import { AUTH_ROUTES } from '@/constants';
import { landingCopy as c } from '@/features/landing/landing-copy';
import { LandingProductMock } from '@/features/landing/landing-product-mock';
import { cn } from '@/lib/utils';

function Section({
  id,
  children,
  className,
  tone = 'canvas',
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  tone?: 'canvas' | 'paper';
}) {
  return (
    <section
      id={id}
      className={cn('border-t border-border/60', tone === 'paper' ? 'bg-paper/50' : 'bg-background', className)}
    >
      <div className="mx-auto max-w-6xl px-6 py-28 md:px-10 md:py-36">{children}</div>
    </section>
  );
}

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="mb-5 text-sm font-medium tracking-[0.16em] text-primary uppercase">{children}</p>;
}

function PrimaryCta({ className, label = c.hero.cta }: { className?: string; label?: string }) {
  return (
    <Button
      nativeButton={false}
      className={cn(
        'h-auto gap-3 rounded-full bg-primary px-7 py-3.5 text-sm font-medium text-primary-foreground hover:bg-brand-deep',
        'active:scale-[0.98]',
        className,
      )}
      render={<Link href={AUTH_ROUTES.signIn} />}
    >
      {label}
      <span className="flex size-7 items-center justify-center rounded-full bg-white/15" aria-hidden>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 12h14M13 5l7 7-7 7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </Button>
  );
}

export function LandingPage() {
  return (
    <div className="relative z-10 flex min-h-full flex-1 flex-col">
      <header className="relative z-40">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 pt-7 md:px-10" aria-label="主导航">
          <BrandMark />
          <div className="hidden items-center gap-9 text-[15px] text-muted-foreground md:flex">
            <a href="#pain" className="transition-colors duration-300 ease-out-soft hover:text-foreground">
              {c.nav.pain}
            </a>
            <a href="#belief" className="transition-colors duration-300 ease-out-soft hover:text-foreground">
              {c.nav.belief}
            </a>
            <a href="#proof" className="transition-colors duration-300 ease-out-soft hover:text-foreground">
              {c.nav.proof}
            </a>
          </div>
          <PrimaryCta className="px-5 py-2.5" label={c.nav.cta} />
        </nav>
      </header>

      {/* 1. Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-16 pb-24 md:px-10 md:pt-24 md:pb-32">
        <div className="grid items-center gap-14 lg:grid-cols-12 lg:gap-12">
          <div className="lg:col-span-5">
            <Eyebrow>{c.hero.eyebrow}</Eyebrow>
            <h1 className="font-heading text-[2.25rem] leading-[1.15] font-bold tracking-tight sm:text-5xl lg:text-[3.15rem]">
              {c.hero.title}
            </h1>
            <p className="mt-8 max-w-lg text-lg leading-relaxed text-muted-foreground md:text-xl">{c.hero.subtitle}</p>
            <div className="mt-11 flex flex-wrap items-center gap-6">
              <PrimaryCta />
              <a
                href="#belief"
                className="text-[15px] font-medium text-muted-foreground transition-colors duration-300 ease-out-soft hover:text-foreground"
              >
                {c.hero.secondary}
              </a>
            </div>
          </div>
          <div className="lg:col-span-7">
            <LandingProductMock />
          </div>
        </div>
      </section>

      {/* 2. Problem */}
      <Section id="problem">
        <div className="max-w-2xl">
          <Eyebrow>{c.problem.eyebrow}</Eyebrow>
          <h2 className="font-heading text-3xl leading-tight font-bold tracking-tight md:text-5xl">
            {c.problem.title}
          </h2>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">{c.problem.lead}</p>
          <ul className="mt-12 max-w-xl space-y-0 divide-y divide-border/80">
            {c.problem.shortages.map((item) => (
              <li key={item} className="py-4 text-lg text-foreground">
                {item}
              </li>
            ))}
          </ul>
        </div>
      </Section>

      {/* 3. Pain */}
      <Section id="pain">
        <div className="max-w-2xl">
          <Eyebrow>{c.pain.eyebrow}</Eyebrow>
          <h2 className="font-heading text-3xl leading-tight font-bold tracking-tight md:text-5xl">{c.pain.title}</h2>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">{c.pain.lead}</p>
        </div>
        <div className="mt-16 grid max-w-3xl gap-x-12 sm:grid-cols-2 md:mt-20">
          <ul className="divide-y divide-border/80">
            {c.pain.items.slice(0, 2).map((item) => (
              <li key={item} className="py-5 text-lg text-foreground">
                {item}
              </li>
            ))}
          </ul>
          <ul className="divide-y divide-border/80">
            {c.pain.items.slice(2).map((item) => (
              <li key={item} className="py-5 text-lg text-foreground">
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-16 max-w-2xl border-t border-border/80 pt-12 md:mt-20">
          <p className="font-heading text-2xl leading-snug font-semibold tracking-tight md:text-3xl">{c.pain.punch}</p>
        </div>
      </Section>

      {/* 4. Origin */}
      <Section id="why" tone="paper">
        <div className="max-w-2xl">
          <Eyebrow>{c.origin.eyebrow}</Eyebrow>
          <h2 className="font-heading text-3xl leading-tight font-bold tracking-tight md:text-5xl">{c.origin.title}</h2>
          <div className="mt-14 space-y-8 text-lg leading-relaxed text-muted-foreground">
            {c.origin.paragraphs.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </div>
      </Section>

      {/* 5. Belief */}
      <Section id="belief">
        <div className="max-w-2xl">
          <Eyebrow>{c.belief.eyebrow}</Eyebrow>
          <h2 className="font-heading text-3xl leading-tight font-bold tracking-tight md:text-5xl">{c.belief.title}</h2>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">{c.belief.lead}</p>
        </div>
        <ol className="mt-16 max-w-3xl space-y-0 border-b border-border/80 md:mt-20">
          {c.belief.items.map((item) => (
            <li key={item.n} className="grid gap-4 border-t border-border/80 py-10 md:grid-cols-12 md:gap-8 md:py-12">
              <span className="font-heading text-2xl font-bold text-primary/25 md:col-span-1">{item.n}</span>
              <div className="md:col-span-11">
                <h3 className="font-heading text-2xl font-semibold tracking-tight">{item.title}</h3>
                <p className="mt-3 max-w-xl leading-relaxed text-muted-foreground">{item.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-10 max-w-2xl text-sm leading-relaxed text-muted-foreground/80">{c.belief.footnote}</p>
      </Section>

      {/* 6. Position */}
      <Section id="position" tone="paper">
        <Eyebrow>{c.position.eyebrow}</Eyebrow>
        <div className="mt-10 grid max-w-4xl gap-12 md:grid-cols-2 md:gap-16">
          <div>
            <p className="text-sm tracking-[0.14em] text-muted-foreground uppercase">{c.position.notLabel}</p>
            <ul className="mt-6 divide-y divide-border/80">
              {c.position.notItems.map((item) => (
                <li key={item} className="py-4 text-lg text-muted-foreground">
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="md:border-l md:border-border/80 md:pl-16">
            <p className="text-sm tracking-[0.14em] text-primary uppercase">{c.position.isLabel}</p>
            <ul className="mt-6 space-y-5">
              {c.position.isItems.map((item) => (
                <li key={item} className="font-heading text-xl leading-snug font-semibold tracking-tight md:text-2xl">
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Section>

      {/* 7. Proof */}
      <Section id="proof">
        <div className="max-w-2xl">
          <Eyebrow>{c.proof.eyebrow}</Eyebrow>
          <h2 className="font-heading text-3xl leading-tight font-bold tracking-tight md:text-5xl">{c.proof.title}</h2>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">{c.proof.lead}</p>
          <p className="mt-8 text-sm tracking-wide text-primary">{c.proof.loop}</p>
        </div>

        <div className="mt-16 grid items-start gap-12 lg:grid-cols-5 lg:gap-14 md:mt-20">
          <div className="space-y-0 lg:col-span-2">
            {c.proof.spaces.map((space) => (
              <div key={space.name} className="border-t border-border/70 py-7 last:border-b">
                <p className="text-sm text-primary">{space.for}</p>
                <h3 className="font-heading mt-2 text-xl font-semibold tracking-tight">{space.name}</h3>
                <p className="mt-2 leading-relaxed text-muted-foreground">{space.body}</p>
              </div>
            ))}
          </div>
          <div className="lg:col-span-3 lg:sticky lg:top-10">
            <LandingProductMock />
          </div>
        </div>
      </Section>

      {/* 8. Invite */}
      <section id="habit" className="border-t border-border/60">
        <div className="mx-auto max-w-6xl px-6 py-24 md:px-10 md:py-32">
          <h2 className="font-heading mx-auto max-w-3xl text-center text-3xl leading-tight font-bold tracking-tight md:text-5xl">
            {c.invite.title}
          </h2>
          <div className="mt-16 flex flex-col items-center justify-center gap-10 md:mt-20 md:flex-row md:gap-0">
            {c.invite.minutes.map((m, i) => (
              <div key={m.n} className="flex items-center md:gap-16">
                {i > 0 ? <div className="mx-16 hidden h-16 w-px bg-border md:block" aria-hidden /> : null}
                <div className="text-center">
                  <p
                    className={cn(
                      'font-heading text-6xl font-bold tracking-tight md:text-7xl',
                      i === 0 && 'text-primary/90',
                      i === 1 && 'text-primary/70',
                      i === 2 && 'text-primary/50',
                    )}
                  >
                    {m.n}
                  </p>
                  <p className="mt-3 text-muted-foreground">{m.label}</p>
                </div>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-14 max-w-lg text-center text-lg leading-relaxed text-muted-foreground">
            {c.invite.body}
          </p>
        </div>
      </section>

      <section id="cta" className="pb-16 md:pb-20">
        <div className="mx-auto max-w-6xl px-6 md:px-10">
          <div className="rounded-[2rem] bg-primary px-8 py-16 text-center text-primary-foreground md:rounded-[2.5rem] md:px-16 md:py-20">
            <h2 className="font-heading text-3xl font-bold tracking-tight md:text-4xl">{c.invite.ctaTitle}</h2>
            <p className="mx-auto mt-5 max-w-md text-lg text-primary-foreground/80">{c.invite.ctaBody}</p>
            <PrimaryCta
              className="mt-10 bg-card text-primary hover:bg-brand-soft hover:text-brand-deep"
              label={c.invite.cta}
            />
          </div>
        </div>
      </section>

      {/* 9. Status — colophon scale */}
      <section id="status" className="border-t border-border/60">
        <div className="mx-auto max-w-6xl px-6 py-16 md:px-10 md:py-20">
          <div className="max-w-xl">
            <p className="text-sm font-medium text-foreground">{c.status.title}</p>
            <p className="mt-4 text-[15px] leading-relaxed text-muted-foreground">{c.status.body}</p>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-10 text-sm text-muted-foreground sm:flex-row sm:items-center md:px-10">
          <BrandMark />
          <p>{c.footer.tagline}</p>
          <p className="text-muted-foreground/70">© {new Date().getFullYear()} Elynd</p>
        </div>
      </footer>
    </div>
  );
}
