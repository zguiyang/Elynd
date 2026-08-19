/** In-situ Learning Room mock for the landing hero / proof. */

export function LandingProductMock() {
  return (
    <div className="rounded-[2rem] bg-foreground/[0.03] p-2 ring-1 ring-foreground/5">
      <div className="overflow-hidden rounded-[calc(2rem-0.5rem)] bg-card shadow-card">
        <div className="flex items-center justify-between border-b border-border/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="size-2 rounded-full bg-muted-foreground/30" aria-hidden />
            <span className="text-xs tracking-wide text-muted-foreground">Learning Room</span>
          </div>
          <span className="text-[11px] tracking-[0.14em] text-primary uppercase">阅读 · 大半能懂</span>
        </div>

        <div className="grid sm:grid-cols-[1.15fr_0.85fr]">
          <div className="border-border/60 px-7 py-8 sm:border-r">
            <h3 className="font-heading text-2xl leading-snug font-semibold tracking-tight">
              The Hidden World
              <br />
              of Oceans
            </h3>
            <div className="mt-6 space-y-4 text-[15px] leading-[1.85] text-muted-foreground">
              <p>
                The ocean covers more than seventy percent of the Earth’s surface, yet we know less about its depths
                than about the surface of the Moon.
              </p>
              <p>
                Beneath the waves lies a world of{' '}
                <span className="border-b border-dotted border-primary/60 text-foreground">currents</span>, creatures,
                and quiet mysteries waiting to be understood.
              </p>
            </div>
          </div>

          <div className="bg-paper/70 px-6 py-8">
            <p className="mb-3 text-[11px] tracking-wide text-muted-foreground">卡住再看</p>
            <div className="rounded-2xl bg-card p-4 ring-1 ring-foreground/5">
              <p className="mb-2 text-xs text-primary">currents</p>
              <p className="text-sm leading-relaxed text-muted-foreground">
                洋流。海洋中持续流动的水体，影响气候与生物栖息。
              </p>
            </div>
            <div className="mt-4 rounded-2xl bg-card/80 p-4 ring-1 ring-foreground/5">
              <p className="mb-2 text-xs text-muted-foreground">今天就读这么多也行</p>
              <p className="text-sm text-foreground">读了 8 分钟</p>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-border">
                <div className="h-full w-2/3 rounded-full bg-primary/80" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
