import '@fontsource-variable/source-sans-3';
import '@fontsource-variable/source-serif-4';
import '@fontsource-variable/noto-sans-sc';
import '@fontsource-variable/noto-serif-sc';
import './globals.css';

import type { Metadata } from 'next';

import { Providers } from '@/components/providers';
import { APP_NAME } from '@/constants';

/**
 * Fonts: Fontsource variable packages (self-hosted woff2 via npm).
 * Avoid `next/font/google` — compile-time gstatic fetches hang behind fake-IP proxies.
 */

export const metadata: Metadata = {
  title: APP_NAME,
  description: '读自己想读的英语',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
