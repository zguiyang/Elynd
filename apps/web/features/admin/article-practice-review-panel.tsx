'use client';

import {
  PRACTICE_ITEMS_MAX,
  PRACTICE_OPTIONS_MAX,
  PRACTICE_OPTIONS_MIN,
  type PracticeItemKind,
  practiceOptionLetter,
} from '@elynd/shared/api/learn';

import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import type { AdminPracticeDraftItem } from '@/features/admin/article-practice-api';

type ArticlePracticeReviewPanelProps = {
  items: AdminPracticeDraftItem[];
  onChange: (items: AdminPracticeDraftItem[]) => void;
};

function emptyComprehension(): AdminPracticeDraftItem {
  return {
    kind: 'comprehension',
    payload: { prompt: '', options: ['', ''] },
    correctOptionIndex: 0,
  };
}

function emptyVocab(): AdminPracticeDraftItem {
  return {
    kind: 'vocab',
    payload: { word: '', hint: '', quote: '', options: ['', ''] },
    correctOptionIndex: 0,
  };
}

/**
 * Admin editable review of draft practice items before PUT replace.
 */
export function ArticlePracticeReviewPanel({ items, onChange }: ArticlePracticeReviewPanelProps) {
  function updateItem(index: number, next: AdminPracticeDraftItem) {
    onChange(items.map((item, i) => (i === index ? next : item)));
  }

  function removeItem(index: number) {
    onChange(items.filter((_, i) => i !== index).map((item, i) => ({ ...item, sortOrder: i + 1 })));
  }

  function addItem(kind: PracticeItemKind) {
    if (items.length >= PRACTICE_ITEMS_MAX) {
      return;
    }
    const created = kind === 'vocab' ? emptyVocab() : emptyComprehension();
    onChange([...items, { ...created, sortOrder: items.length + 1 }]);
  }

  if (items.length === 0) {
    return (
      <section className="rounded-3xl border border-dashed border-border bg-card px-6 py-12 text-center">
        <p className="text-sm text-muted-foreground">没有可审查的题目。请先生成，或手动添加。</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => addItem('comprehension')}>
            添加理解题
          </Button>
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => addItem('vocab')}>
            添加词汇题
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
          保存入库前可改题干、选项与正确答案。题干与选项宜用中文；词汇题的单词与原文引用保持英文。最多{' '}
          {PRACTICE_ITEMS_MAX} 题。
        </p>
      </div>

      {items.map((item, index) => {
        const options = item.payload.options;
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
                    { label: '理解', value: 'comprehension' },
                    { label: '词汇', value: 'vocab' },
                  ]}
                  value={item.kind}
                  onValueChange={(value) => {
                    if (value == null) {
                      return;
                    }
                    const kind = value as PracticeItemKind;
                    updateItem(
                      index,
                      kind === 'vocab'
                        ? { ...emptyVocab(), sortOrder: item.sortOrder }
                        : { ...emptyComprehension(), sortOrder: item.sortOrder },
                    );
                  }}
                >
                  <SelectTrigger className="h-11 w-full rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="comprehension">理解</SelectItem>
                      <SelectItem value="vocab">词汇</SelectItem>
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

            {item.kind === 'comprehension' && 'prompt' in item.payload ? (
              <Field className="mt-4">
                <FieldLabel className="text-muted-foreground">题干</FieldLabel>
                <Textarea
                  value={item.payload.prompt}
                  className="min-h-24 rounded-xl"
                  onChange={(e) =>
                    updateItem(index, {
                      ...item,
                      payload: { ...item.payload, prompt: e.target.value },
                    })
                  }
                />
              </Field>
            ) : null}

            {item.kind === 'vocab' && 'word' in item.payload ? (
              <div className="mt-4 grid gap-4">
                <Field>
                  <FieldLabel className="text-muted-foreground">单词</FieldLabel>
                  <Input
                    value={item.payload.word}
                    className="h-11 rounded-xl"
                    onChange={(e) =>
                      updateItem(index, {
                        ...item,
                        payload: { ...item.payload, word: e.target.value },
                      })
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel className="text-muted-foreground">提示</FieldLabel>
                  <Input
                    value={item.payload.hint}
                    className="h-11 rounded-xl"
                    onChange={(e) =>
                      updateItem(index, {
                        ...item,
                        payload: { ...item.payload, hint: e.target.value },
                      })
                    }
                  />
                </Field>
                <Field>
                  <FieldLabel className="text-muted-foreground">原文引用</FieldLabel>
                  <Textarea
                    value={item.payload.quote}
                    className="min-h-20 rounded-xl"
                    onChange={(e) =>
                      updateItem(index, {
                        ...item,
                        payload: { ...item.payload, quote: e.target.value },
                      })
                    }
                  />
                </Field>
              </div>
            ) : null}

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
                        payload: { ...item.payload, options: nextOptions },
                        correctOptionIndex: Math.min(item.correctOptionIndex, nextOptions.length - 1),
                      });
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-xl"
                    disabled={options.length <= PRACTICE_OPTIONS_MIN}
                    onClick={() => {
                      const nextOptions = options.filter((_, i) => i !== optionIndex);
                      updateItem(index, {
                        ...item,
                        payload: { ...item.payload, options: nextOptions },
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
                disabled={options.length >= PRACTICE_OPTIONS_MAX}
                onClick={() => {
                  updateItem(index, {
                    ...item,
                    payload: { ...item.payload, options: [...options, ''] },
                  });
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
          disabled={items.length >= PRACTICE_ITEMS_MAX}
          onClick={() => addItem('comprehension')}
        >
          添加理解题
        </Button>
        <Button
          type="button"
          variant="outline"
          className="rounded-xl"
          disabled={items.length >= PRACTICE_ITEMS_MAX}
          onClick={() => addItem('vocab')}
        >
          添加词汇题
        </Button>
      </div>
    </section>
  );
}
