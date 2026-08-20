'use client';

import { Combobox } from '@base-ui/react/combobox';
import { CheckIcon, PlusIcon, XIcon } from 'lucide-react';
import { useId, useMemo, useRef, useState } from 'react';

import { ARTICLE_THEME_MAX_ITEMS, ARTICLE_THEME_MAX_LEN } from '@gloaming/shared/api/articles';

import { cn } from '@/lib/utils';

/** Common theme values for the admin form suggestions list. */
export const ARTICLE_THEME_SUGGESTIONS = ['story', 'fable', 'situational'] as const;

type ThemeOption = {
  id: string;
  value: string;
  creatable?: string;
};

type ArticleThemesInputProps = {
  id?: string;
  value: string[];
  onChange: (themes: string[]) => void;
  disabled?: boolean;
  className?: string;
};

function normalizeTheme(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}

function themeId(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function toOption(value: string): ThemeOption {
  const normalized = normalizeTheme(value);
  return { id: themeId(normalized), value: normalized };
}

function uniqueOptions(values: string[]): ThemeOption[] {
  const seen = new Set<string>();
  const options: ThemeOption[] = [];
  for (const value of values) {
    const option = toOption(value);
    if (!option.value || seen.has(option.id)) {
      continue;
    }
    seen.add(option.id);
    options.push(option);
  }
  return options;
}

export function ArticleThemesInput({ id, value, onChange, disabled, className }: ArticleThemesInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const [query, setQuery] = useState('');
  const [createdValues, setCreatedValues] = useState<string[]>([]);
  const highlightedRef = useRef<ThemeOption | undefined>(undefined);

  const catalog = useMemo(
    () => uniqueOptions([...ARTICLE_THEME_SUGGESTIONS, ...createdValues, ...value]),
    [createdValues, value],
  );
  const selected = useMemo(() => uniqueOptions(value), [value]);
  const isAtLimit = selected.length >= ARTICLE_THEME_MAX_ITEMS;

  const trimmed = normalizeTheme(query);
  const lowered = trimmed.toLocaleLowerCase();
  const hasExactMatch = catalog.some((item) => item.id === lowered);
  const itemsForView: ThemeOption[] =
    trimmed !== '' && !hasExactMatch && !isAtLimit && trimmed.length <= ARTICLE_THEME_MAX_LEN
      ? [...catalog, { id: `create:${lowered}`, value: `创建「${trimmed}」`, creatable: trimmed }]
      : catalog;

  function commitThemes(next: ThemeOption[]) {
    const themes = next
      .filter((item) => !item.creatable)
      .map((item) => item.value)
      .slice(0, ARTICLE_THEME_MAX_ITEMS);
    onChange(themes);
    setQuery('');
  }

  function createTheme(raw: string) {
    const normalized = normalizeTheme(raw);
    if (!normalized || normalized.length > ARTICLE_THEME_MAX_LEN || isAtLimit) {
      return;
    }
    const option = toOption(normalized);
    setCreatedValues((prev) => (prev.some((item) => themeId(item) === option.id) ? prev : [...prev, option.value]));
    if (!selected.some((item) => item.id === option.id)) {
      onChange([...selected.map((item) => item.value), option.value].slice(0, ARTICLE_THEME_MAX_ITEMS));
    }
    setQuery('');
  }

  return (
    <Combobox.Root
      multiple
      items={itemsForView}
      value={selected}
      onValueChange={(next) => {
        const creatable = next.find((item) => item.creatable && !selected.some((current) => current.id === item.id));
        if (creatable?.creatable) {
          createTheme(creatable.creatable);
          return;
        }
        commitThemes(next.filter((item) => !item.creatable));
      }}
      inputValue={query}
      onInputValueChange={(next) => {
        if (disabled) {
          return;
        }
        setQuery(next);
      }}
      onItemHighlighted={(item) => {
        highlightedRef.current = item;
      }}
      isItemEqualToValue={(a, b) => a.id === b.id}
      itemToStringLabel={(item) => item.value}
      disabled={disabled}
    >
      <Combobox.InputGroup
        className={cn(
          'flex min-h-11 w-full flex-wrap items-center gap-1.5 rounded-xl border border-input bg-transparent px-2.5 py-1.5 transition-colors focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50 has-aria-invalid:border-destructive has-aria-invalid:ring-3 has-aria-invalid:ring-destructive/20',
          disabled && 'pointer-events-none cursor-not-allowed opacity-50',
          className,
        )}
      >
        <Combobox.Chips className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <Combobox.Value>
            {(chips: ThemeOption[]) => (
              <>
                {chips.map((theme) => (
                  <Combobox.Chip
                    key={theme.id}
                    className="inline-flex h-7 items-center gap-1 rounded-full bg-secondary px-2.5 text-xs font-medium text-secondary-foreground"
                    aria-label={theme.value}
                  >
                    {theme.value}
                    <Combobox.ChipRemove
                      className="rounded-full p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      aria-label={`移除 ${theme.value}`}
                      disabled={disabled}
                    >
                      <XIcon className="size-3" />
                    </Combobox.ChipRemove>
                  </Combobox.Chip>
                ))}
                <Combobox.Input
                  id={inputId}
                  disabled={disabled || isAtLimit}
                  placeholder={chips.length > 0 ? '' : '输入主题后回车，或从列表选择'}
                  className="min-w-24 flex-1 border-0 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' || event.nativeEvent.isComposing) {
                      return;
                    }
                    if (highlightedRef.current) {
                      return;
                    }
                    if (!trimmed) {
                      return;
                    }
                    event.preventDefault();
                    createTheme(trimmed);
                  }}
                />
              </>
            )}
          </Combobox.Value>
        </Combobox.Chips>
      </Combobox.InputGroup>

      <Combobox.Portal>
        <Combobox.Positioner className="z-50 outline-none" sideOffset={6}>
          <Combobox.Popup className="max-h-60 w-[var(--anchor-width)] overflow-auto rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-md outline-none">
            <Combobox.Empty className="px-3 py-2 text-sm text-muted-foreground">无匹配主题</Combobox.Empty>
            <Combobox.List>
              {(item: ThemeOption) =>
                item.creatable ? (
                  <Combobox.Item
                    key={item.id}
                    value={item}
                    className="flex cursor-default items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none data-highlighted:bg-muted"
                  >
                    <PlusIcon className="size-4 text-muted-foreground" />
                    <span>创建「{item.creatable}」</span>
                  </Combobox.Item>
                ) : (
                  <Combobox.Item
                    key={item.id}
                    value={item}
                    className="flex cursor-default items-center gap-2 rounded-lg px-3 py-2 text-sm outline-none data-highlighted:bg-muted data-selected:font-medium"
                  >
                    <span className="flex size-4 items-center justify-center text-foreground">
                      <Combobox.ItemIndicator>
                        <CheckIcon className="size-3.5" />
                      </Combobox.ItemIndicator>
                    </span>
                    <span className="flex-1">{item.value}</span>
                  </Combobox.Item>
                )
              }
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}
