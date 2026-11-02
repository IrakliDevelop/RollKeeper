import type { Metadata } from 'next';
import { LauncherTable } from '@/components/launcher/LauncherTable';

export const metadata: Metadata = {
  title: 'RollKeeper',
  description:
    'D&D 5e character sheets for players, and initiative and battle maps for the DM.',
};

export default function HomePage() {
  return <LauncherTable />;
}
