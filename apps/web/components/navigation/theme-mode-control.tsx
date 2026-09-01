'use client';

import { Menu } from '@base-ui/react/menu';
import { CheckIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useSyncExternalStore } from 'react';

import { NAV_COPY } from '@/components/navigation/nav-config';
import { cn } from '@/lib/utils';

export type ThemeMode = 'light' | 'dark' | 'system';

export const THEME_MODE_OPTIONS: readonly { value: ThemeMode; label: string }[] = [
  { value: 'light', label: NAV_COPY.themeLight },
  { value: 'dark', label: NAV_COPY.themeDark },
  { value: 'system', label: NAV_COPY.themeSystem },
] as const;

function subscribeNoop() {
  return () => {};
}

function useIsClient() {
  return useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );
}

function resolveThemeMode(theme: string | undefined, isClient: boolean): ThemeMode {
  if (!isClient) {
    return 'system';
  }
  if (theme === 'light' || theme === 'dark') {
    return theme;
  }
  return 'system';
}

const menuItemClass = cn(
  'flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-sm',
  'text-foreground outline-none select-none',
  'data-highlighted:bg-muted',
);

/** AccountMenu — Base UI Menu radio group for theme mode. */
export function ThemeModeMenuItems() {
  const { theme, setTheme } = useTheme();
  const isClient = useIsClient();
  const current = resolveThemeMode(theme, isClient);

  return (
    <Menu.Group>
      <Menu.GroupLabel className="px-2.5 pt-1.5 pb-1 text-xs font-medium text-muted-foreground">
        {NAV_COPY.themeAppearance}
      </Menu.GroupLabel>
      <Menu.RadioGroup
        value={current}
        onValueChange={(value) => {
          if (value === 'light' || value === 'dark' || value === 'system') {
            setTheme(value);
          }
        }}
      >
        {THEME_MODE_OPTIONS.map((option) => (
          <Menu.RadioItem
            key={option.value}
            value={option.value}
            label={option.label}
            aria-label={option.label}
            className={menuItemClass}
          >
            {option.label}
            <Menu.RadioItemIndicator className="flex size-4 items-center justify-center text-primary">
              <CheckIcon className="size-4" strokeWidth={2} aria-hidden />
            </Menu.RadioItemIndicator>
          </Menu.RadioItem>
        ))}
      </Menu.RadioGroup>
    </Menu.Group>
  );
}

/** Mobile More Sheet — compact theme mode list. */
export function ThemeModeSheetSection() {
  const { theme, setTheme } = useTheme();
  const isClient = useIsClient();
  const current = resolveThemeMode(theme, isClient);

  return (
    <div className="flex flex-col gap-1">
      <p className="px-2.5 pt-1 text-xs font-medium tracking-wide text-muted-foreground">{NAV_COPY.themeAppearance}</p>
      {THEME_MODE_OPTIONS.map((option) => {
        const isSelected = current === option.value;
        return (
          <button
            key={option.value}
            type="button"
            className={cn(
              'flex items-center justify-between rounded-xl px-2.5 py-3 text-sm transition-colors duration-200 ease-out-soft',
              isSelected ? 'bg-muted text-foreground' : 'text-foreground hover:bg-muted/60',
            )}
            aria-label={option.label}
            aria-pressed={isSelected}
            onClick={() => setTheme(option.value)}
          >
            {option.label}
            {isSelected ? <CheckIcon className="size-4 text-primary" strokeWidth={2} aria-hidden /> : null}
          </button>
        );
      })}
    </div>
  );
}
