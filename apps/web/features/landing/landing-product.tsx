import { landingCopy as c } from '@/features/landing/landing-copy';
import { LandingCompanionCard, LandingFrameImage } from '@/features/landing/landing-product-mock';
import { LandingSection } from '@/features/landing/landing-section';
import { cn } from '@/lib/utils';

function FeatureCopy({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h3 className="font-heading text-2xl font-semibold text-primary">{title}</h3>
      <p className="font-reading mt-6 max-w-md text-lg leading-relaxed text-foreground/80">{body}</p>
    </div>
  );
}

function JourneyColumn({ title, items, tone }: { title: string; items: readonly string[]; tone: 'past' | 'next' }) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-3xl bg-card p-10 shadow-card ring-1 md:p-12',
        tone === 'next' ? 'ring-primary/30' : 'ring-border/40',
      )}
    >
      {tone === 'next' ? (
        <div className="pointer-events-none absolute -top-16 -right-16 size-32 rounded-bl-full bg-primary/5" />
      ) : null}
      <h4
        className={cn(
          'text-xs font-semibold tracking-[0.15em] uppercase',
          tone === 'next' ? 'text-primary' : 'text-muted-foreground',
        )}
      >
        {title}
      </h4>
      <ol className="font-reading mt-10 flex flex-col gap-8 text-lg leading-relaxed">
        {items.map((item, index) => {
          const isTurn = index === 1 || index === items.length - 1;
          return (
            <li key={item} className="flex items-center gap-4">
              <span
                className={cn(
                  'size-2 shrink-0 rounded-full',
                  tone === 'next'
                    ? isTurn
                      ? 'size-2.5 bg-primary'
                      : 'bg-primary/40'
                    : isTurn
                      ? 'bg-destructive/70'
                      : 'bg-outline/40',
                )}
                aria-hidden
              />
              <span
                className={cn(
                  tone === 'next'
                    ? isTurn
                      ? 'font-medium text-primary'
                      : 'text-foreground/80'
                    : isTurn
                      ? 'text-destructive/80'
                      : 'text-muted-foreground',
                )}
              >
                {item}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function LandingProduct() {
  return (
    <>
      <LandingSection id="reader" tone="card">
        <h2 className="font-heading text-center text-3xl leading-tight font-semibold tracking-tight md:text-4xl">
          {c.product.title}
        </h2>

        <div className="mt-24 flex flex-col gap-32">
          <div className="grid items-center gap-12 md:grid-cols-2 md:gap-16">
            <LandingFrameImage src="/landing/reader-ui.png" alt={c.product.reader.imageAlt} />
            <FeatureCopy title={c.product.reader.title} body={c.product.reader.body} />
          </div>

          <div id="companion" className="grid scroll-mt-20 items-center gap-12 md:grid-cols-2 md:gap-16">
            <div className="md:order-1">
              <FeatureCopy title={c.product.companion.title} body={c.product.companion.body} />
            </div>
            <div className="md:order-2">
              <LandingCompanionCard />
            </div>
          </div>

          <div id="shelf" className="grid scroll-mt-20 items-center gap-12 md:grid-cols-2 md:gap-16">
            <LandingFrameImage src="/landing/shelf.jpg" alt={c.product.shelf.imageAlt} />
            <FeatureCopy title={c.product.shelf.title} body={c.product.shelf.body} />
          </div>
        </div>
      </LandingSection>

      <LandingSection id="friction">
        <div className="text-center">
          <h2 className="font-heading text-3xl leading-tight font-semibold tracking-tight md:text-4xl">
            {c.friction.title}
          </h2>
          <p className="font-reading mx-auto mt-6 max-w-2xl text-lg font-medium text-foreground/80">
            {c.friction.lead}
          </p>
        </div>
        <div className="mx-auto mt-16 grid max-w-5xl gap-8 md:grid-cols-2 md:gap-12">
          <JourneyColumn title={c.friction.pastTitle} items={c.friction.pastItems} tone="past" />
          <JourneyColumn title={c.friction.nextTitle} items={c.friction.nextItems} tone="next" />
        </div>
      </LandingSection>
    </>
  );
}
