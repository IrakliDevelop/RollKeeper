import type { Metadata } from 'next';
import { LandingPage } from '@/components/landing/LandingPage';
import { HERO_SUBLINE } from '@/components/landing/landingCopy';
import { readRoadmap } from '@/lib/roadmap/readRoadmap';

export const metadata: Metadata = {
  title: 'RollKeeper',
  description: HERO_SUBLINE,
};

export default async function HomePage() {
  const roadmap = await readRoadmap();
  const ahead = roadmap.sections.filter(
    s => s.heading === 'In progress' || s.heading === 'Next'
  );
  return <LandingPage roadmap={ahead} />;
}
