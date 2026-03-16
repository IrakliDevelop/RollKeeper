'use client';

import Link from 'next/link';
import {
  Users,
  Crown,
  Sword,
  FileText,
  Dice6,
  Shield,
  Star,
  ArrowRight,
  Sparkles,
  Zap,
  BookOpen,
  ScrollText,
  Swords,
  Heart,
} from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';

function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  return (
    <button
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="border-divider bg-surface-raised text-muted hover:bg-surface-hover hover:text-heading rounded-lg border p-2 transition-colors"
      aria-label="Toggle theme"
    >
      {theme === 'dark' ? (
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
          />
        </svg>
      ) : (
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
          />
        </svg>
      )}
    </button>
  );
}

function FloatingDice() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <div className="animate-float text-accent-purple-border-strong absolute top-[15%] left-[10%] opacity-20">
        <Dice6 className="h-16 w-16 md:h-24 md:w-24" />
      </div>
      <div className="animate-float-delayed text-accent-blue-border-strong absolute top-[20%] right-[15%] opacity-15">
        <Shield className="h-12 w-12 md:h-20 md:w-20" />
      </div>
      <div className="animate-float-slow text-accent-amber-border-strong absolute bottom-[20%] left-[5%] opacity-15">
        <Sword className="h-14 w-14 md:h-18 md:w-18" />
      </div>
      <div className="animate-float text-accent-emerald-border-strong absolute right-[8%] bottom-[25%] opacity-15">
        <Star className="h-10 w-10 md:h-16 md:w-16" />
      </div>
      <div className="animate-float-delayed text-accent-red-border-strong absolute top-[8%] left-[45%] opacity-10">
        <Crown className="h-10 w-10 md:h-14 md:w-14" />
      </div>
    </div>
  );
}

const STATS = [
  { value: '12', label: 'D&D Classes', icon: BookOpen },
  { value: '300+', label: 'Spells', icon: Sparkles },
  { value: '400+', label: 'Monsters', icon: Swords },
  { value: '100%', label: 'Free to Use', icon: Heart },
];

const FEATURES = [
  {
    title: 'Smart Character Sheets',
    description:
      'Auto-calculating stats, modifiers, and proficiency bonuses. Your sheet evolves as your character levels up.',
    icon: FileText,
    accent: 'blue' as const,
  },
  {
    title: 'Combat Tracker',
    description:
      'Visual initiative order with drag-and-drop. Track HP, conditions, and resources in real time.',
    icon: Sword,
    accent: 'red' as const,
  },
  {
    title: 'Campaign Sync',
    description:
      'DMs see player stats live. No more asking "what\'s your AC?" — it\'s all there, updating in real time.',
    icon: Zap,
    accent: 'amber' as const,
  },
  {
    title: 'Spell Management',
    description:
      'Full spell database with search, slot tracking, and prepared spell lists. Never lose track of your magic.',
    icon: Sparkles,
    accent: 'purple' as const,
  },
  {
    title: 'Monster Bestiary',
    description:
      'Searchable creature database with stats, abilities, and challenge ratings for encounter building.',
    icon: ScrollText,
    accent: 'emerald' as const,
  },
  {
    title: 'Multi-Character Roster',
    description:
      'Manage all your characters in one place. Switch between campaigns and characters effortlessly.',
    icon: Users,
    accent: 'indigo' as const,
  },
];

const ACCENT_STYLES = {
  blue: {
    iconBg: 'bg-accent-blue-bg',
    iconText: 'text-accent-blue-text',
    border: 'group-hover:border-accent-blue-border-strong',
  },
  red: {
    iconBg: 'bg-accent-red-bg',
    iconText: 'text-accent-red-text',
    border: 'group-hover:border-accent-red-border-strong',
  },
  amber: {
    iconBg: 'bg-accent-amber-bg',
    iconText: 'text-accent-amber-text',
    border: 'group-hover:border-accent-amber-border-strong',
  },
  purple: {
    iconBg: 'bg-accent-purple-bg',
    iconText: 'text-accent-purple-text',
    border: 'group-hover:border-accent-purple-border-strong',
  },
  emerald: {
    iconBg: 'bg-accent-emerald-bg',
    iconText: 'text-accent-emerald-text',
    border: 'group-hover:border-accent-emerald-border-strong',
  },
  indigo: {
    iconBg: 'bg-accent-indigo-bg',
    iconText: 'text-accent-indigo-text',
    border: 'group-hover:border-accent-indigo-border-strong',
  },
};

export default function LandingPage() {
  return (
    <div className="bg-surface min-h-screen">
      {/* ── Header ── */}
      <header className="border-divider bg-surface-raised/80 sticky top-0 z-50 border-b backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="bg-accent-purple-bg-strong flex h-9 w-9 items-center justify-center rounded-lg">
              <Dice6 className="text-accent-purple-text h-5 w-5" />
            </div>
            <span className="font-cinzel text-heading text-xl font-bold">
              RollKeeper
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {[
              { href: '/player', label: 'Players' },
              { href: '/dm', label: 'Dungeon Masters' },
              { href: '/bestiary', label: 'Bestiary' },
              { href: '/spellbook', label: 'Spellbook' },
            ].map(link => (
              <Link
                key={link.href}
                href={link.href}
                className="text-muted hover:bg-surface-hover hover:text-heading rounded-lg px-3 py-2 text-sm font-medium transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="/player"
              className="bg-accent-purple-bg-strong text-accent-purple-text hidden rounded-lg px-4 py-2 text-sm font-semibold transition-all hover:opacity-80 sm:inline-flex"
            >
              Get Started
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden px-4 pt-20 pb-16 sm:px-6 sm:pt-28 sm:pb-24 lg:px-8 lg:pt-36 lg:pb-32">
        <FloatingDice />

        {/* Gradient orbs */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
        >
          <div className="bg-accent-purple-bg-strong absolute -top-40 -left-40 h-80 w-80 rounded-full opacity-40 blur-[100px]" />
          <div className="bg-accent-blue-bg-strong absolute top-20 -right-40 h-96 w-96 rounded-full opacity-30 blur-[120px]" />
          <div className="bg-accent-emerald-bg-strong absolute -bottom-20 left-1/3 h-72 w-72 rounded-full opacity-25 blur-[100px]" />
        </div>

        <div className="relative mx-auto max-w-4xl text-center">
          {/* Badge */}
          <div className="landing-fade-in border-divider bg-surface-raised text-muted mb-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm shadow-sm">
            <Sparkles className="text-accent-amber-text h-3.5 w-3.5" />
            <span>Free & open source D&D companion</span>
          </div>

          <h1 className="landing-fade-in landing-delay-1 text-heading mb-6 text-4xl font-bold tracking-tight sm:text-5xl lg:text-7xl">
            Your Tabletop,{' '}
            <span className="from-accent-purple-text via-accent-blue-text to-accent-emerald-text bg-gradient-to-r bg-clip-text text-transparent">
              Supercharged
            </span>
          </h1>

          <p className="landing-fade-in landing-delay-2 text-body mx-auto mb-10 max-w-2xl text-lg leading-relaxed sm:text-xl">
            RollKeeper is the complete digital toolset for D&D 5e.
            Auto-calculating character sheets, live campaign sync, and a full
            reference library — all in your browser.
          </p>

          {/* CTA buttons */}
          <div className="landing-fade-in landing-delay-3 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link
              href="/player"
              className="group bg-accent-purple-bg-strong text-accent-purple-text inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-base font-semibold shadow-lg transition-all hover:opacity-90 hover:shadow-xl"
            >
              <Users className="h-5 w-5" />
              Start as Player
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/dm"
              className="group border-divider bg-surface-raised text-heading hover:border-accent-purple-border inline-flex items-center gap-2 rounded-xl border px-8 py-3.5 text-base font-semibold shadow-sm transition-all hover:shadow-md"
            >
              <Crown className="text-accent-amber-text h-5 w-5" />
              Start as DM
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Stats bar ── */}
      <section className="border-divider bg-surface-secondary/50 border-y">
        <div className="divide-divider mx-auto grid max-w-5xl grid-cols-2 divide-x sm:grid-cols-4">
          {STATS.map(stat => (
            <div
              key={stat.label}
              className="flex flex-col items-center gap-1 px-4 py-6 sm:py-8"
            >
              <stat.icon className="text-muted mb-1 h-5 w-5" />
              <span className="text-heading text-2xl font-bold sm:text-3xl">
                {stat.value}
              </span>
              <span className="text-muted text-xs font-medium sm:text-sm">
                {stat.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features bento grid ── */}
      <section className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <h2 className="text-heading mb-4 text-3xl font-bold sm:text-4xl">
              Everything You Need at the Table
            </h2>
            <p className="text-muted mx-auto max-w-2xl text-lg">
              Powerful tools designed to stay out of your way. Less time
              managing, more time playing.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(feature => {
              const styles = ACCENT_STYLES[feature.accent];
              return (
                <div
                  key={feature.title}
                  className={`group border-divider bg-surface-raised rounded-2xl border p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${styles.border}`}
                >
                  <div
                    className={`mb-4 inline-flex rounded-xl p-3 ${styles.iconBg}`}
                  >
                    <feature.icon className={`h-6 w-6 ${styles.iconText}`} />
                  </div>
                  <h3 className="text-heading mb-2 text-lg font-semibold">
                    {feature.title}
                  </h3>
                  <p className="text-muted text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Player & DM sections ── */}
      <section className="border-divider bg-surface-secondary/30 border-t px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <h2 className="text-heading mb-4 text-3xl font-bold sm:text-4xl">
              Built for Both Sides of the Screen
            </h2>
            <p className="text-muted mx-auto max-w-2xl text-lg">
              Whether you wield the sword or weave the story, RollKeeper has
              your back.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Player card */}
            <div className="group border-divider bg-surface-raised relative overflow-hidden rounded-2xl border p-8 transition-all duration-300 hover:shadow-xl">
              <div className="bg-accent-blue-bg absolute -top-10 -right-10 h-40 w-40 rounded-full opacity-50 transition-transform duration-500 group-hover:scale-150" />
              <div className="relative">
                <div className="mb-6 flex items-center gap-4">
                  <div className="bg-accent-blue-bg-strong flex h-14 w-14 items-center justify-center rounded-2xl">
                    <Users className="text-accent-blue-text h-7 w-7" />
                  </div>
                  <div>
                    <h3 className="text-heading text-2xl font-bold">
                      For Players
                    </h3>
                    <p className="text-muted text-sm">
                      Your characters, perfected
                    </p>
                  </div>
                </div>

                <ul className="mb-8 space-y-3">
                  {[
                    {
                      icon: Shield,
                      text: 'Manage multiple characters across campaigns',
                    },
                    {
                      icon: FileText,
                      text: 'Auto-calculating sheets — no manual math',
                    },
                    {
                      icon: Sparkles,
                      text: 'Full spell list with slot tracking',
                    },
                    { icon: Dice6, text: 'Integrated 3D dice rolling' },
                  ].map(item => (
                    <li key={item.text} className="flex items-center gap-3">
                      <div className="bg-accent-blue-bg flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                        <item.icon className="text-accent-blue-text h-4 w-4" />
                      </div>
                      <span className="text-body text-sm">{item.text}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/player"
                  className="group/btn bg-accent-blue-bg-strong text-accent-blue-text inline-flex items-center gap-2 rounded-xl px-6 py-3 font-semibold transition-all hover:opacity-80"
                >
                  Open Player Dashboard
                  <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                </Link>
              </div>
            </div>

            {/* DM card */}
            <div className="group border-divider bg-surface-raised relative overflow-hidden rounded-2xl border p-8 transition-all duration-300 hover:shadow-xl">
              <div className="bg-accent-purple-bg absolute -top-10 -right-10 h-40 w-40 rounded-full opacity-50 transition-transform duration-500 group-hover:scale-150" />
              <div className="relative">
                <div className="mb-6 flex items-center gap-4">
                  <div className="bg-accent-purple-bg-strong flex h-14 w-14 items-center justify-center rounded-2xl">
                    <Crown className="text-accent-purple-text h-7 w-7" />
                  </div>
                  <div>
                    <h3 className="text-heading text-2xl font-bold">
                      For Dungeon Masters
                    </h3>
                    <p className="text-muted text-sm">
                      Run your world with confidence
                    </p>
                  </div>
                </div>

                <ul className="mb-8 space-y-3">
                  {[
                    {
                      icon: ScrollText,
                      text: 'Campaign management with session notes',
                    },
                    {
                      icon: Swords,
                      text: 'Visual combat tracker with initiative order',
                    },
                    {
                      icon: Zap,
                      text: 'Live player sync — see stats in real time',
                    },
                    {
                      icon: BookOpen,
                      text: 'Full bestiary and spell reference',
                    },
                  ].map(item => (
                    <li key={item.text} className="flex items-center gap-3">
                      <div className="bg-accent-purple-bg flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                        <item.icon className="text-accent-purple-text h-4 w-4" />
                      </div>
                      <span className="text-body text-sm">{item.text}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/dm"
                  className="group/btn bg-accent-purple-bg-strong text-accent-purple-text inline-flex items-center gap-2 rounded-xl px-6 py-3 font-semibold transition-all hover:opacity-80"
                >
                  Open DM Toolset
                  <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Reference library ── */}
      <section className="px-4 py-20 sm:px-6 sm:py-28 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-14 text-center">
            <h2 className="text-heading mb-4 text-3xl font-bold sm:text-4xl">
              Reference Library
            </h2>
            <p className="text-muted mx-auto max-w-xl text-lg">
              Browse the complete D&D 5e database — spells, monsters, classes,
              and more.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              {
                href: '/spellbook',
                title: 'Spellbook',
                description:
                  'Search and filter every spell by class, level, or school',
                icon: Sparkles,
                accent: 'blue' as const,
              },
              {
                href: '/bestiary',
                title: 'Bestiary',
                description:
                  'Browse monsters with stats, abilities, and challenge ratings',
                icon: Swords,
                accent: 'red' as const,
              },
              {
                href: '/classes',
                title: 'Classes',
                description:
                  'Explore class features, subclasses, and progression tables',
                icon: BookOpen,
                accent: 'emerald' as const,
              },
            ].map(item => {
              const styles = ACCENT_STYLES[item.accent];
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group border-divider bg-surface-raised rounded-2xl border p-6 text-center transition-all duration-300 hover:-translate-y-1 hover:shadow-lg ${styles.border}`}
                >
                  <div
                    className={`mx-auto mb-4 inline-flex rounded-xl p-3 ${styles.iconBg}`}
                  >
                    <item.icon className={`h-6 w-6 ${styles.iconText}`} />
                  </div>
                  <h3 className="text-heading mb-2 text-lg font-semibold">
                    {item.title}
                  </h3>
                  <p className="text-muted mb-4 text-sm">{item.description}</p>
                  <span className="text-accent-purple-text inline-flex items-center gap-1 text-sm font-medium transition-colors">
                    Browse
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CTA banner ── */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="border-divider bg-surface-raised relative mx-auto max-w-4xl overflow-hidden rounded-3xl border p-10 text-center shadow-xl sm:p-16">
          <div
            className="pointer-events-none absolute inset-0"
            aria-hidden="true"
          >
            <div className="bg-accent-purple-bg-strong absolute -top-20 -left-20 h-60 w-60 rounded-full opacity-40 blur-[80px]" />
            <div className="bg-accent-blue-bg-strong absolute -right-20 -bottom-20 h-60 w-60 rounded-full opacity-40 blur-[80px]" />
          </div>

          <div className="relative">
            <Dice6 className="text-accent-purple-text mx-auto mb-6 h-12 w-12" />
            <h2 className="text-heading mb-4 text-3xl font-bold sm:text-4xl">
              Ready to Roll?
            </h2>
            <p className="text-muted mx-auto mb-8 max-w-lg text-lg">
              No sign-up required. Your data stays in your browser. Start
              building your character in seconds.
            </p>
            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/player/characters/new"
                className="group bg-accent-purple-bg-strong text-accent-purple-text inline-flex items-center gap-2 rounded-xl px-8 py-3.5 text-base font-semibold shadow-md transition-all hover:opacity-90 hover:shadow-lg"
              >
                Create Your First Character
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/dm"
                className="border-divider text-muted hover:border-accent-purple-border hover:text-heading inline-flex items-center gap-2 rounded-xl border px-8 py-3.5 text-base font-medium transition-all"
              >
                Or start a campaign
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-divider bg-surface-secondary/50 border-t px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col items-center justify-between gap-8 sm:flex-row">
            <div className="flex items-center gap-2.5">
              <div className="bg-accent-purple-bg-strong flex h-8 w-8 items-center justify-center rounded-lg">
                <Dice6 className="text-accent-purple-text h-4 w-4" />
              </div>
              <span className="font-cinzel text-heading text-lg font-bold">
                RollKeeper
              </span>
            </div>

            <nav className="flex flex-wrap items-center justify-center gap-6">
              {[
                { href: '/player', label: 'Player Tools' },
                { href: '/dm', label: 'DM Tools' },
                { href: '/spellbook', label: 'Spellbook' },
                { href: '/bestiary', label: 'Bestiary' },
                { href: '/classes', label: 'Classes' },
              ].map(link => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-muted hover:text-heading text-sm transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          <div className="border-divider mt-8 border-t pt-8 text-center">
            <p className="text-faint text-sm">
              Built with care for the D&D community. All game content is
              property of its respective owners.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
