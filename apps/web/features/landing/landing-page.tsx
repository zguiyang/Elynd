import { SiteNav } from '@/components/site-nav';
import { LandingCta, LandingFooter } from '@/features/landing/landing-close';
import { LandingHero } from '@/features/landing/landing-hero';
import { LandingNavEntrance } from '@/features/landing/landing-motion';
import { LandingProduct } from '@/features/landing/landing-product';
import { LandingStory } from '@/features/landing/landing-story';

export function LandingPage() {
  return (
    <div className="relative z-10 flex min-h-full flex-1 flex-col">
      <LandingNavEntrance>
        <SiteNav />
      </LandingNavEntrance>
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
