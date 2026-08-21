'use client';

export function HistoryHeader() {
  return (
    <header className="mb-8 w-full text-left md:mx-auto md:mb-10 md:max-w-reading-column md:text-center">
      <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground md:text-5xl md:leading-[1.15]">
        阅读历史
      </h1>
      <p className="mt-2 text-sm text-muted-foreground md:mt-4 md:font-heading md:text-xl md:leading-8">
        回望你与英文相处的时间。
      </p>
    </header>
  );
}
