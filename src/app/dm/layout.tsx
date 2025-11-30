import { Metadata } from 'next';
import Link from 'next/link';
import { Home } from 'lucide-react';

export const metadata: Metadata = {
  title: 'DM Toolset - RollKeeper',
  description:
    'Campaign management and combat tracking tools for Dungeon Masters - Coming Soon',
};

export default function DMLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="dm-layout min-h-screen bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-100">
      {/* DM Header */}
      <header className="bg-gradient-to-r from-purple-600 to-purple-800 text-white shadow-lg">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <h1 className="text-xl font-bold">DM Toolset</h1>
              <span className="ml-3 rounded-full bg-purple-700 px-3 py-1 text-xs font-semibold">
                Coming Soon
              </span>
            </div>
            <Link
              href="/"
              className="flex items-center transition-colors hover:text-purple-200"
            >
              <Home className="mr-2 h-5 w-5" />
              Home
            </Link>
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
