import { LandingPrimaryCta } from '@/features/landing/landing-auth';
import { landingCopy as c } from '@/features/landing/landing-copy';
import { LandingSection } from '@/features/landing/landing-section';

export function LandingCta() {
  return (
    <LandingSection id="cta" tone="paper" className="text-center">
      <div className="mx-auto max-w-3xl">
        <h2 className="font-heading text-3xl leading-tight font-bold tracking-tight md:text-5xl">{c.invite.title}</h2>
        <p className="font-reading mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-foreground/80 md:text-xl">
          {c.invite.body}
        </p>
        <div className="mt-12 flex justify-center">
          <LandingPrimaryCta label={c.invite.cta} className="px-10 py-5 text-lg" />
        </div>
      </div>
    </LandingSection>
  );
}

export function LandingFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border/60 bg-card">
      <div className="mx-auto flex max-w-container-max flex-col items-center justify-between gap-6 px-6 py-8 md:flex-row md:px-8">
        <p className="font-heading text-2xl font-semibold text-foreground">{c.brand}</p>
        <p className="text-sm text-muted-foreground">
          © {year} {c.brand}. {c.footer.tagline}
        </p>
        <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
          {c.footer.links.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="transition-colors duration-300 ease-out-soft hover:text-primary"
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
