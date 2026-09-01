'use client';

import { Menu } from '@base-ui/react/menu';
import { CheckIcon, MoonIcon, SunIcon } from 'lucide-react';
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

/** SiteNav — icon button left of avatar; menu for light / dark / system. */
export function ThemeModeNavButton() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const isClient = useIsClient();
  const current = resolveThemeMode(theme, isClient);
  const Icon = isClient && resolvedTheme === 'dark' ? SunIcon : MoonIcon;

  return (
    <Menu.Root>
      <Menu.Trigger
        className={cn(
          'flex size-9 items-center justify-center rounded-full text-muted-foreground',
          'outline-none transition-opacity duration-300 ease-out-soft hover:opacity-80',
          'focus-visible:ring-3 focus-visible:ring-ring/50',
        )}
        aria-label={NAV_COPY.themeAppearance}
      >
        <Icon className="size-5" strokeWidth={1.5} aria-hidden />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className="z-50 outline-none" sideOffset={8} align="end">
          <Menu.Popup
            className={cn(
              'min-w-44 rounded-xl bg-card p-1 shadow-card ring-1 ring-foreground/5 outline-none',
              'transition-opacity duration-200 ease-out-soft',
              'data-starting-style:opacity-0 data-ending-style:opacity-0',
            )}
          >
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
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
