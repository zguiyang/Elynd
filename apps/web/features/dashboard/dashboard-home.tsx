'use client';

import { Play } from 'lucide-react';
import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { AUTH_ROUTES, LEARN_DEMO } from '@/constants';
import { useAppUser } from '@/features/dashboard/app-shell';
import { DASHBOARD_FAKE, greetingForHour } from '@/features/dashboard/dashboard-data';

export function DashboardHome() {
  const user = useAppUser();
  const name = user?.name?.trim() || user?.username || '读者';
  const greeting = greetingForHour(new Date().getHours(), name);
  const { continueReading, inProgress, recommendations, stats } = DASHBOARD_FAKE;

  return (
    <div className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-3 motion-safe:duration-700 mx-auto max-w-6xl">
      <h1 className="font-heading text-4xl font-bold tracking-tight md:text-5xl">{greeting}</h1>
      <p className="mt-3 text-lg text-muted-foreground">想读就读一会儿。不必硬撑一小时。</p>

      <section className="mt-10 flex flex-col items-stretch justify-between gap-8 rounded-3xl bg-paper p-8 md:flex-row md:items-center md:p-10">
        <div className="max-w-xl">
          <p className="mb-4 text-sm text-brand-deep">{continueReading.eyebrow}</p>
          <h2 className="font-heading text-3xl font-bold tracking-tight md:text-4xl">
            {continueReading.titleLines[0]}
            <br />
            {continueReading.titleLines[1]}
          </h2>
          <p className="mt-5 text-muted-foreground">{continueReading.blurb}</p>

          <div className="mt-5 flex flex-wrap gap-5 text-sm text-muted-foreground">
            {continueReading.meta.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>

          <div className="mt-6 h-2 overflow-hidden rounded-full bg-card">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out-soft"
              style={{ width: `${continueReading.progress}%` }}
            />
          </div>

          <Button
            nativeButton={false}
            className="mt-7 h-11 gap-2 rounded-xl px-7 hover:bg-brand-deep"
            render={<Link href={AUTH_ROUTES.learnArticle(LEARN_DEMO.oceans)} />}
          >
            <Play className="size-4" strokeWidth={1.5} aria-hidden />
            开始阅读
          </Button>
        </div>

        {/* eslint-disable-next-line @next/next/no-img-element -- static prototype cover */}
        <img
          className="h-72 w-56 shrink-0 rounded-3xl object-cover shadow-card ring-1 ring-foreground/5 md:h-80 md:w-64"
          src={continueReading.coverSrc}
          alt={continueReading.coverAlt}
        />
      </section>

      <section className="mt-12 grid gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <h3 className="mb-5 text-xl font-semibold">继续阅读</h3>
          <Link
            href={AUTH_ROUTES.learnArticle(LEARN_DEMO.habits)}
            className="flex flex-col gap-6 rounded-3xl border border-border bg-card p-6 transition-colors duration-300 ease-out-soft hover:bg-muted/30 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:flex-row"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- static prototype cover */}
            <img
              className="h-40 w-32 shrink-0 rounded-2xl object-cover"
              src={inProgress.coverSrc}
              alt={inProgress.coverAlt}
            />
            <div className="min-w-0 flex-1">
              <h4 className="font-heading text-2xl font-bold tracking-tight">{inProgress.title}</h4>
              <p className="mt-3 text-muted-foreground">{inProgress.subtitle}</p>
              <div className="mt-5 text-sm text-foreground">阅读进度 {inProgress.progress}%</div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${inProgress.progress}%` }} />
              </div>
              <p className="mt-4 text-sm font-medium text-brand-deep">继续阅读</p>
            </div>
          </Link>
        </div>

        <div>
          <h3 className="mb-5 text-xl font-semibold">为你推荐</h3>
          <div className="space-y-4">
            {recommendations.map((item) => (
              <div
                key={item.title}
                className="flex gap-4 rounded-3xl border border-border bg-card p-4 transition-colors duration-300 ease-out-soft hover:bg-muted/40"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- static prototype cover */}
                <img className="h-24 w-20 shrink-0 rounded-xl object-cover" src={item.coverSrc} alt={item.coverAlt} />
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{item.title}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{item.meta}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-12 rounded-3xl border border-border bg-card p-8">
        <h3 className="text-xl font-semibold">跟英语相处多久了</h3>
        <div className="mt-8 grid grid-cols-3 gap-4 text-foreground">
          {stats.map((stat) => (
            <div key={stat.label}>
              <p className="text-2xl font-semibold">{stat.value}</p>
              <p className="mt-1 text-sm text-muted-foreground">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
