import './globals.css';

import type { Metadata } from 'next';
import { Noto_Sans_SC, Noto_Serif_SC, Source_Sans_3, Source_Serif_4 } from 'next/font/google';

import { Providers } from '@/components/providers';
import { APP_NAME } from '@/constants';

const sourceSans = Source_Sans_3({
  variable: '--font-elynd-sans',
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
});

const notoSansSc = Noto_Sans_SC({
  variable: '--font-elynd-sans-sc',
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  preload: false,
});

const sourceSerif = Source_Serif_4({
  variable: '--font-elynd-heading',
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
});

const notoSerifSc = Noto_Serif_SC({
  variable: '--font-elynd-heading-sc',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  display: 'swap',
  preload: false,
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: 'AI-assisted English reading for work',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${sourceSans.variable} ${notoSansSc.variable} ${sourceSerif.variable} ${notoSerifSc.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
