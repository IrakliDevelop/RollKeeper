import type { Metadata } from 'next';
import { AppHeader } from '@/components/ui/layout/AppHeader';
import { RoadmapTrail } from '@/components/roadmap/RoadmapTrail';
import { readRoadmap } from '@/lib/roadmap/readRoadmap';

export const metadata: Metadata = {
  title: 'RollKeeper roadmap',
  description:
    'What RollKeeper does today, what comes next and what is not built yet.',
};

export default async function RoadmapPage() {
  const { sections } = await readRoadmap();
  return (
    <div className="bg-surface text-body min-h-screen">
      <AppHeader title={null} />
      <main className="mx-auto flex max-w-3xl flex-col gap-10 px-4 py-10 sm:px-6">
        <h1 className="type-title text-heading">Roadmap</h1>
        <RoadmapTrail sections={sections} />
      </main>
    </div>
  );
}
