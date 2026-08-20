'use client';

import { useState } from 'react';

import type { ArticleLevel } from '@gloaming/shared/api/articles';
import { practiceOptionLetter } from '@gloaming/shared/api/learn';
import {
  REVIEW_ITEMS_MAX,
  REVIEW_OPTIONS_MAX,
  REVIEW_OPTIONS_MIN,
  type ReviewItemKind,
} from '@gloaming/shared/api/review';

import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { AdminReviewDraftItem } from '@/features/admin/article-review-api';
import { LEVEL_LABEL } from '@/features/library/library-model';
import { splitFocus } from '@/features/review/review-model';
import { cn } from '@/lib/utils';

const KIND_LABEL: Record<ReviewItemKind, string> = {
  cloze: '填空',
  sense: '释义',
};

type GeneratePanelProps = {
  level: ArticleLevel;
  isGenerating: boolean;
  hasDraft: boolean;
  onGenerate: () => void;
};

export function ArticleReviewGeneratePanel({ level, isGenerating, hasDraft, onGenerate }: GeneratePanelProps) {
  return (
    <section className="rounded-3xl border border-border bg-card px-6 py-7 md:px-8 md:py-9">
      <p className="text-sm font-medium tracking-[0.16em] text-brand-deep">生成</p>
      <h2 className="mt-3 font-heading text-2xl font-bold tracking-tight">根据正文出复习题</h2>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground">
        使用文章正文与难度（{LEVEL_LABEL[level]}
        ）生成 cloze / sense 题，供读完后的「再碰一次」使用，不复用练习题。结果先进入本页草稿，审查后再保存入库。
      </p>
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          className="h-11 rounded-xl px-6 hover:bg-brand-deep"
          disabled={isGenerating}
          onClick={onGenerate}
        >
          {isGenerating ? '生成中…' : hasDraft ? '重新生成草稿' : '根据正文生成'}
        </Button>
        {hasDraft ? <p className="text-sm text-muted-foreground">已有草稿，可到「预览 / 审查」查看或修改。</p> : null}
      </div>
    </section>
  );
}

type PreviewPanelProps = {
  items: AdminReviewDraftItem[];
};

export function ArticleReviewPreviewPanel({ items }: PreviewPanelProps) {
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  if (items.length === 0) {
    return (
      <section className="rounded-3xl border border-dashed border-border bg-paper/60 px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">还没有草稿题目。请先在「生成」里出题。</p>
      </section>
    );
  }

  const safeIndex = Math.min(index, items.length - 1);
  const item = items[safeIndex]!;
  const parts = splitFocus(item.sentence, item.focus);

  return (
    <section className="rounded-3xl border border-border bg-paper px-6 py-7 md:px-10 md:py-9">
      <p className="text-sm font-medium tracking-[0.16em] text-brand-deep">运营预览</p>
      <p className="mt-2 text-sm text-muted-foreground">
        模拟学习者再碰界面；点选不会保存作答。正确答案：{practiceOptionLetter(item.correctOptionIndex)}
      </p>

      <div className="mt-8 max-w-xl">
        <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {KIND_LABEL[item.kind]} · {safeIndex + 1} / {items.length}
        </p>
        <p className="mt-3 font-heading text-xl font-semibold tracking-tight">
          {parts ? (
            <>
              {parts.before}
              <span className="text-brand-deep">{item.kind === 'cloze' ? '____' : parts.match}</span>
              {parts.after}
            </>
          ) : (
            item.sentence
          )}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{item.hintZh}</p>

        <ul className="mt-6 flex flex-col gap-2">
          {item.options.map((option, optionIndex) => {
            const isSelected = selected === optionIndex;
            const isCorrect = optionIndex === item.correctOptionIndex;
            return (
              <li key={`${safeIndex}-${optionIndex}`}>
                <button
                  type="button"
                  className={cn(
                    'w-full rounded-xl border px-4 py-3 text-left text-sm transition-colors duration-300 ease-out-soft',
                    isSelected
                      ? isCorrect
                        ? 'border-brand/40 bg-accent text-accent-foreground'
                        : 'border-destructive/40 bg-destructive/5 text-foreground'
                      : 'border-border bg-card text-foreground hover:bg-muted/40',
                  )}
                  onClick={() => setSelected(optionIndex)}
                >
                  <span className="mr-2 font-medium text-muted-foreground">{practiceOptionLetter(optionIndex)}.</span>
                  {option}
                </button>
              </li>
            );
          })}
        </ul>

        <div className="mt-8 flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-xl"
            disabled={safeIndex <= 0}
            onClick={() => {
              setIndex((prev) => Math.max(0, prev - 1));
              setSelected(null);
            }}
          >
            上一题
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-10 rounded-xl"
            disabled={safeIndex >= items.length - 1}
            onClick={() => {
              setIndex((prev) => Math.min(items.length - 1, prev + 1));
              setSelected(null);
            }}
          >
            下一题
          </Button>
        </div>
      </div>
    </section>
  );
}

function emptyItem(kind: ReviewItemKind): AdminReviewDraftItem {
  return {
    kind,
    sentence: '',
    focus: '',
    options: ['', ''],
    hintZh: '',
    correctOptionIndex: 0,
  };
}

type ReviewPanelProps = {
  items: AdminReviewDraftItem[];
  onChange: (items: AdminReviewDraftItem[]) => void;
};

export function ArticleReviewReviewPanel({ items, onChange }: ReviewPanelProps) {
  function updateItem(index: number, next: AdminReviewDraftItem) {
    onChange(items.map((item, i) => (i === index ? next : item)));
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index).map((item, i) => ({ ...item, sortOrder: i + 1 })));
  }

  function addItem(kind: ReviewItemKind) {
    if (items.length >= REVIEW_ITEMS_MAX) {
      return;
    }
    onChange([...items, { ...emptyItem(kind), sortOrder: items.length + 1 }]);
  }

  if (items.length === 0) {
    return (
      <section className="rounded-3xl border border-dashed border-border bg-card px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">没有可审查的题目。请先生成，或手动添加。</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => addItem('cloze')}>
            添加填空题
          </Button>
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => addItem('sense')}>
            添加释义题
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-6">
      <div>
        <p className="text-sm font-medium tracking-[0.16em] text-brand-deep">审查</p>
        <h2 className="mt-2 font-heading text-2xl font-bold tracking-tight">编辑草稿题目</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          保存入库前可改句子、焦点、选项与正确答案。填空选项用英文，释义选项用中文。最多 {REVIEW_ITEMS_MAX} 题。
        </p>
      </div>

      {items.map((item, index) => {
        const options = item.options;
        return (
          <article key={index} className="rounded-3xl border border-border bg-card px-5 py-6 md:px-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-medium text-foreground">第 {index + 1} 题</p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-xl text-destructive"
                onClick={() => removeItem(index)}
              >
                删除
              </Button>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel className="text-muted-foreground">类型</FieldLabel>
                <Select
                  items={[
                    { label: '填空', value: 'cloze' },
                    { label: '释义', value: 'sense' },
                  ]}
                  value={item.kind}
                  onValueChange={(value) => {
                    if (value == null) {
                      return;
                    }
                    updateItem(index, { ...emptyItem(value as ReviewItemKind), sortOrder: item.sortOrder });
                  }}
                >
                  <SelectTrigger className="h-11 w-full rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="cloze">填空</SelectItem>
                      <SelectItem value="sense">释义</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel className="text-muted-foreground">正确答案</FieldLabel>
                <Select
                  items={options.map((_, optionIndex) => ({
                    label: practiceOptionLetter(optionIndex),
                    value: String(optionIndex),
                  }))}
                  value={String(item.correctOptionIndex)}
                  onValueChange={(value) => {
                    if (value == null) {
                      return;
                    }
                    updateItem(index, { ...item, correctOptionIndex: Number(value) });
                  }}
                >
                  <SelectTrigger className="h-11 w-full rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {options.map((_, optionIndex) => (
                        <SelectItem key={optionIndex} value={String(optionIndex)}>
                          {practiceOptionLetter(optionIndex)}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field className="mt-4">
              <FieldLabel className="text-muted-foreground">原句</FieldLabel>
              <Textarea
                value={item.sentence}
                className="min-h-24 rounded-xl"
                onChange={(e) => updateItem(index, { ...item, sentence: e.target.value })}
              />
            </Field>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field>
                <FieldLabel className="text-muted-foreground">焦点</FieldLabel>
                <Input
                  value={item.focus}
                  className="h-11 rounded-xl"
                  onChange={(e) => updateItem(index, { ...item, focus: e.target.value })}
                />
              </Field>
              <Field>
                <FieldLabel className="text-muted-foreground">中文提示</FieldLabel>
                <Input
                  value={item.hintZh}
                  className="h-11 rounded-xl"
                  onChange={(e) => updateItem(index, { ...item, hintZh: e.target.value })}
                />
              </Field>
            </div>

            <div className="mt-4 flex flex-col gap-2">
              <FieldLabel className="text-muted-foreground">选项</FieldLabel>
              {options.map((option, optionIndex) => (
                <div key={optionIndex} className="flex items-center gap-2">
                  <span className="w-6 shrink-0 text-center text-sm font-medium text-muted-foreground">
                    {practiceOptionLetter(optionIndex)}
                  </span>
                  <Input
                    value={option}
                    className="h-11 flex-1 rounded-xl"
                    aria-label={`选项 ${practiceOptionLetter(optionIndex)}`}
                    onChange={(e) => {
                      const nextOptions = options.map((value, i) => (i === optionIndex ? e.target.value : value));
                      updateItem(index, {
                        ...item,
                        options: nextOptions,
                        correctOptionIndex: Math.min(item.correctOptionIndex, nextOptions.length - 1),
                      });
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-xl"
                    disabled={options.length <= REVIEW_OPTIONS_MIN}
                    onClick={() => {
                      const nextOptions = options.filter((_, i) => i !== optionIndex);
                      updateItem(index, {
                        ...item,
                        options: nextOptions,
                        correctOptionIndex: Math.min(
                          item.correctOptionIndex >= optionIndex && item.correctOptionIndex > 0
                            ? item.correctOptionIndex - 1
                            : item.correctOptionIndex,
                          nextOptions.length - 1,
                        ),
                      });
                    }}
                  >
                    删
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-1 w-fit rounded-xl"
                disabled={options.length >= REVIEW_OPTIONS_MAX}
                onClick={() => {
                  updateItem(index, { ...item, options: [...options, ''] });
                }}
              >
                加选项
              </Button>
            </div>
          </article>
        );
      })}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          className="rounded-xl"
          disabled={items.length >= REVIEW_ITEMS_MAX}
          onClick={() => addItem('cloze')}
        >
          添加填空题
        </Button>
        <Button
          type="button"
          variant="outline"
          className="rounded-xl"
          disabled={items.length >= REVIEW_ITEMS_MAX}
          onClick={() => addItem('sense')}
        >
          添加释义题
        </Button>
      </div>
    </section>
  );
}
