import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'DM Toolset - RollKeeper',
  description:
    'Campaign management and combat tracking tools for Dungeon Masters',
};

export default function DMLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dm-layout min-h-screen bg-slate-100">
      {/* DM Header */}
      <header className="bg-gradient-to-r from-purple-600 to-purple-800 text-white shadow-lg">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <h1 className="text-xl font-bold">DM Toolset</h1>
              <span className="ml-2 text-sm text-purple-200">RollKeeper</span>
            </div>
            <nav className="hidden space-x-6 md:flex">
              <Link
                href="/dm"
                className="transition-colors hover:text-purple-200"
              >
                Dashboard
              </Link>
              <Link
                href="/dm/campaigns"
                className="transition-colors hover:text-purple-200"
              >
                Campaigns
              </Link>
              <Link
                href="/dm/settings"
                className="transition-colors hover:text-purple-200"
              >
                Settings
              </Link>
              <Link
                href="/"
                className="transition-colors hover:text-purple-200"
              >
                Character Sheet
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
