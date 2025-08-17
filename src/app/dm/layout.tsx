import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'DM Toolset - RollKeeper',
  description: 'Campaign management and combat tracking tools for Dungeon Masters',
};

export default function DMLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="dm-layout min-h-screen bg-slate-100">
      {/* DM Header */}
      <header className="bg-gradient-to-r from-purple-600 to-purple-800 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold">DM Toolset</h1>
              <span className="ml-2 text-purple-200 text-sm">RollKeeper</span>
            </div>
            <nav className="hidden md:flex space-x-6">
              <a href="/dm" className="hover:text-purple-200 transition-colors">
                Dashboard
              </a>
              <a href="/dm/campaigns" className="hover:text-purple-200 transition-colors">
                Campaigns
              </a>
              <a href="/dm/settings" className="hover:text-purple-200 transition-colors">
                Settings
              </a>
              <a href="/" className="hover:text-purple-200 transition-colors">
                Character Sheet
              </a>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
