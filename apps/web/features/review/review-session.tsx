'use client';

import { ChevronDownIcon, Volume2Icon } from 'lucide-react';
import { type ReactNode, useEffect, useRef } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { type ReviewItem, splitFocus } from '@/features/review/review-model';
import { cn } from '@/lib/utils';

type ReviewSessionProps = {
  articleTitle: string;
  paragraphs: string[];
  item: ReviewItem;
  itemIndex: number;
  total: number;
  selectedIndex: number | null;
  isChecked: boolean;
  isSourceOpen: boolean;
  hint: string | null;
  onSelect: (optionIndex: number) => void;
  onConfirm: () => void;
  onNext: () => void;
  onEarly: () => void;
  onSourceOpenChange: (open: boolean) => void;
};

/**
 * One re-meet: sentence in view, inline listen, in-page source, options.
 */
export function ReviewSession({
  articleTitle,
  paragraphs,
  item,
  itemIndex,
  total,
  selectedIndex,
  isChecked,
  isSourceOpen,
  hint,
  onSelect,
  onConfirm,
  onNext,
  onEarly,
  onSourceOpenChange,
}: ReviewSessionProps) {
  const filled = isChecked ? (item.options[item.correctIndex] ?? item.focus) : null;

  return (
    <>
      <p className="mt-10 text-base leading-relaxed text-muted-foreground">
        来自 <span className="font-heading font-semibold tracking-tight text-foreground">{articleTitle}</span>
      </p>

      <div className="mt-6 border-t border-border pt-12 pb-10 md:pt-16 md:pb-12">
        <ReviewSentence
          item={item}
          filled={filled}
          listen={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="听原句"
              className="ml-1 inline-flex translate-y-[-0.12em] align-middle text-muted-foreground hover:text-foreground"
              onClick={() => {
                toast('暂时还没法读。');
              }}
            >
              <Volume2Icon strokeWidth={1.5} />
            </Button>
          }
        />

        {hint ? (
          <p
            className={cn(
              'motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200 mt-6 max-w-[36rem] text-base leading-relaxed',
              selectedIndex === item.correctIndex ? 'text-muted-foreground' : 'text-foreground',
            )}
          >
            {hint}
          </p>
        ) : null}

        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-expanded={isSourceOpen}
          aria-controls="review-source"
          className="mt-4 rounded-xl px-2 text-muted-foreground hover:text-foreground"
          onClick={() => onSourceOpenChange(!isSourceOpen)}
        >
          原文
          <ChevronDownIcon
            data-icon="inline-end"
            strokeWidth={1.5}
            className={cn(
              'transition-transform duration-300 ease-out-soft motion-reduce:transition-none',
              isSourceOpen && 'rotate-180',
            )}
          />
        </Button>

        <ReviewSourceReveal paragraphs={paragraphs} sentence={item.sentence} open={isSourceOpen} />

        <ReviewOptions item={item} selectedIndex={selectedIndex} isLocked={isChecked} onSelect={onSelect} />
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-border pt-6">
        <button type="button" className="text-sm text-muted-foreground hover:text-foreground" onClick={onEarly}>
          先到这
        </button>
        {isChecked ? (
          <Button type="button" className="h-11 rounded-xl px-7 hover:bg-brand-deep" onClick={onNext}>
            下一条
          </Button>
        ) : (
          <Button
            type="button"
            className="h-11 rounded-xl px-7 hover:bg-brand-deep"
            disabled={selectedIndex == null}
            onClick={onConfirm}
          >
            确定
          </Button>
        )}
      </div>
      <p className="sr-only">
        {itemIndex + 1} / {total}
      </p>
    </>
  );
}

function ReviewSentence({ item, filled, listen }: { item: ReviewItem; filled: string | null; listen: ReactNode }) {
  const parts = splitFocus(item.sentence, item.focus);
  const body = !parts ? (
    item.sentence
  ) : item.kind === 'cloze' ? (
    <>
      {parts.before}
      <span className="inline-block min-w-[4.5rem] border-b border-foreground/35 px-1 text-center">
        {filled ? <span className="text-brand-deep">{filled}</span> : <span className="sr-only">空缺</span>}
      </span>
      {parts.after}
    </>
  ) : (
    <>
      {parts.before}
      <span className="text-brand-deep">{parts.match}</span>
      {parts.after}
    </>
  );

  return (
    <div className="font-heading text-2xl leading-relaxed font-semibold tracking-tight md:text-[1.75rem]">
      {body}
      {listen}
    </div>
  );
}

function ReviewOptions({
  item,
  selectedIndex,
  isLocked,
  onSelect,
}: {
  item: ReviewItem;
  selectedIndex: number | null;
  isLocked: boolean;
  onSelect: (optionIndex: number) => void;
}) {
  return (
    <div
      className={cn('mt-8 gap-3', item.kind === 'sense' ? 'flex flex-col' : 'flex flex-wrap')}
      role="listbox"
      aria-label="选项"
    >
      {item.options.map((option, optionIndex) => {
        const isSelected = selectedIndex === optionIndex;
        return (
          <button
            key={option}
            type="button"
            role="option"
            aria-selected={isSelected}
            disabled={isLocked}
            className={cn(
              'rounded-xl border px-4 py-3.5 text-left text-sm leading-relaxed transition-colors duration-300 ease-out-soft',
              item.kind === 'cloze' ? 'min-w-[7.5rem]' : 'w-full',
              isSelected
                ? 'border-brand-deep/30 bg-accent text-brand-deep'
                : 'border-border bg-transparent text-foreground hover:bg-muted/60',
              isLocked && !isSelected && 'opacity-60',
            )}
            onClick={() => onSelect(optionIndex)}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}

function ReviewSourceReveal({ paragraphs, sentence, open }: { paragraphs: string[]; sentence: string; open: boolean }) {
  const currentRef = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    currentRef.current?.scrollIntoView({ block: 'nearest' });
  }, [open, sentence]);

  return (
    <div
      id="review-source"
      className={cn(
        'grid transition-[grid-template-rows] duration-300 ease-out-soft motion-reduce:transition-none',
        open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
      )}
    >
      <div className="min-h-0 overflow-hidden">
        <div className="mt-6 flex flex-col gap-4 border-t border-border pt-6">
          {paragraphs.map((paragraph) => {
            const isCurrent = paragraph === sentence;
            return (
              <p
                key={paragraph}
                ref={isCurrent ? currentRef : undefined}
                className={cn('text-base leading-relaxed', isCurrent ? 'text-foreground' : 'text-muted-foreground')}
              >
                {paragraph}
              </p>
            );
          })}
        </div>
      </div>
    </div>
  );
}
