import type { Metadata } from 'next';

import { APP_NAME } from '@/constants';
import { LandingPage } from '@/features/landing';

export const metadata: Metadata = {
  title: `${APP_NAME} — 读自己想读的英语`,
  description: '给总是学不下去的人：有趣、大半能懂的英文，每天读一小段。',
};

export default function Home() {
  return <LandingPage />;
}
