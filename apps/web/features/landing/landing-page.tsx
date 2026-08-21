import { LandingPrimaryCta } from '@/features/landing/landing-auth';
import { LandingCta, LandingFooter } from '@/features/landing/landing-close';
import { landingCopy as c } from '@/features/landing/landing-copy';
import { LandingNav } from '@/features/landing/landing-nav';
import { LandingProduct } from '@/features/landing/landing-product';
import { LandingStory } from '@/features/landing/landing-story';

function LandingHero() {
  return (
    <header className="mx-auto flex max-w-container-max flex-col items-center px-6 pt-24 pb-20 text-center md:px-8 md:pt-32 md:pb-24">
      <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-700 motion-safe:ease-out">
        <h1 className="font-heading max-w-3xl text-[2.25rem] leading-[1.15] font-bold tracking-tight sm:text-5xl md:text-[48px] md:leading-[56px]">
          {c.hero.title}
        </h1>
        <p className="font-reading mx-auto mt-8 max-w-2xl text-xl leading-8 text-foreground/70">{c.hero.subtitle}</p>
        <div className="mt-12 flex justify-center">
          <LandingPrimaryCta label={c.hero.cta} />
        </div>
      </div>
    </header>
  );
}

export function LandingPage() {
  return (
    <div className="relative z-10 flex min-h-full flex-1 flex-col">
      <LandingNav />
      <main>
        <LandingHero />
        <LandingStory />
        <LandingProduct />
        <LandingCta />
      </main>
      <LandingFooter />
    </div>
  );
}
