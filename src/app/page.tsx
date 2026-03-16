'use client';

import Link from 'next/link';
import { useState, useRef } from 'react';
import {
  motion,
  AnimatePresence,
  useInView,
  useScroll,
  useTransform,
} from 'framer-motion';
import {
  Users,
  Crown,
  Sword,
  FileText,
  Dice6,
  Shield,
  Star,
  ArrowRight,
  Menu,
  X,
  BookOpen,
  Bug,
  Layers,
  Zap,
  Lock,
  Wifi,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Card, CardContent } from '@/components/ui/layout/card';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import {
  fadeVariants,
  animationTransitions,
} from '@/components/ui/primitives/animations';

const landingStagger = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.15 },
  },
};

const landingItem = {
  hidden: { opacity: 0, y: 24 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: 'easeOut' as const },
  },
};

function AnimatedSection({
  children,
  className = '',
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 40 }}
      animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
      transition={{ duration: 0.7, delay, ease: [0.25, 0.46, 0.45, 0.94] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function GradientOrb({
  className,
  color,
}: {
  className: string;
  color: string;
}) {
  return (
    <div
      className={`pointer-events-none absolute rounded-full blur-3xl ${className}`}
      style={{ background: color }}
      aria-hidden="true"
    />
  );
}

const FEATURES = [
  {
    icon: FileText,
    title: 'Smart Character Sheets',
    description:
      'Auto-calculating stats, spell slots, and modifiers. Manage multiple characters with tabbed, organized sheets.',
    accent: 'text-accent-blue-text',
    accentMuted: 'text-accent-blue-text-muted',
    bg: 'bg-accent-blue-bg',
    bgStrong: 'bg-accent-blue-bg-strong',
    gradient: 'from-blue-500/20 to-indigo-500/20',
  },
  {
    icon: Wifi,
    title: 'Live Campaign Sync',
    description:
      'DMs see player HP, stats, and inventory in real time. Players join campaigns with a simple code.',
    accent: 'text-accent-purple-text',
    accentMuted: 'text-accent-purple-text-muted',
    bg: 'bg-accent-purple-bg',
    bgStrong: 'bg-accent-purple-bg-strong',
    gradient: 'from-purple-500/20 to-pink-500/20',
  },
  {
    icon: BookOpen,
    title: 'D&D Reference Library',
    description:
      '540+ spells, full bestiary, and class compendium at your fingertips. Search, filter, and reference mid-session.',
    accent: 'text-accent-emerald-text',
    accentMuted: 'text-accent-emerald-text-muted',
    bg: 'bg-accent-emerald-bg',
    bgStrong: 'bg-accent-emerald-bg-strong',
    gradient: 'from-emerald-500/20 to-teal-500/20',
  },
] as const;

const PLAYER_FEATURES = [
  { icon: Layers, text: 'Multiple characters in one place' },
  { icon: Zap, text: 'Auto-calculating sheets — no manual math' },
  { icon: Dice6, text: 'Integrated 3D dice rolling' },
  { icon: Star, text: 'Track spells, inventory, and abilities' },
] as const;

const DM_FEATURES = [
  { icon: Sword, text: 'Visual combat & initiative tracker' },
  { icon: Users, text: 'Live player sync dashboard' },
  { icon: Bug, text: 'Full monster bestiary with search' },
  { icon: FileText, text: 'Session notes & campaign management' },
] as const;

const REFERENCE_TOOLS = [
  {
    href: '/spellbook',
    title: 'Spellbook',
    stat: '540+ spells',
    icon: BookOpen,
    accent: 'text-accent-indigo-text',
    bg: 'bg-accent-indigo-bg',
    border: 'border-accent-indigo-border',
    hoverBorder: 'hover:border-accent-indigo-border-strong',
  },
  {
    href: '/bestiary',
    title: 'Bestiary',
    stat: 'Full monster database',
    icon: Bug,
    accent: 'text-accent-red-text',
    bg: 'bg-accent-red-bg',
    border: 'border-accent-red-border',
    hoverBorder: 'hover:border-accent-red-border-strong',
  },
  {
    href: '/classes',
    title: 'Class Compendium',
    stat: 'All classes & subclasses',
    icon: Shield,
    accent: 'text-accent-emerald-text',
    bg: 'bg-accent-emerald-bg',
    border: 'border-accent-emerald-border',
    hoverBorder: 'hover:border-accent-emerald-border-strong',
  },
] as const;

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const heroRef = useRef(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const heroParallaxY = useTransform(scrollYProgress, [0, 1], [0, 150]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <div className="bg-surface min-h-screen">
      {/* ── Header ── */}
      <header className="border-divider bg-surface/80 fixed top-0 right-0 left-0 z-50 border-b backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <Dice6 className="text-accent-purple-text h-7 w-7" />
              <span className="font-cinzel text-heading text-xl font-bold tracking-wide">
                RollKeeper
              </span>
            </Link>

            <nav className="hidden items-center gap-1 md:flex">
              <Link
                href="/player"
                className="text-body hover:text-accent-blue-text hover:bg-accent-blue-bg rounded-lg px-3 py-1.5 text-sm font-medium transition-all"
              >
                Player
              </Link>
              <Link
                href="/dm"
                className="text-body hover:text-accent-purple-text hover:bg-accent-purple-bg rounded-lg px-3 py-1.5 text-sm font-medium transition-all"
              >
                DM Tools
              </Link>
              <Link
                href="/resources"
                className="text-body hover:text-accent-emerald-text hover:bg-accent-emerald-bg rounded-lg px-3 py-1.5 text-sm font-medium transition-all"
              >
                Resources
              </Link>
              <div className="bg-divider mx-2 h-5 w-px" />
              <ThemeToggle />
              <div className="w-2" />
              <Button
                variant="secondary"
                size="sm"
                rightIcon={<ArrowRight size={14} />}
                asChild
              >
                <Link href="/player">Get Started</Link>
              </Button>
            </nav>

            <div className="flex items-center gap-2 md:hidden">
              <ThemeToggle />
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="text-heading hover:bg-surface-hover rounded-lg p-2 transition-colors"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={animationTransitions.slow}
              className="border-divider bg-surface overflow-hidden border-t md:hidden"
            >
              <nav className="flex flex-col gap-1 px-4 py-3">
                <Link
                  href="/player"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-body hover:text-accent-blue-text hover:bg-accent-blue-bg rounded-lg px-3 py-2.5 text-sm font-medium transition-all"
                >
                  Player Dashboard
                </Link>
                <Link
                  href="/dm"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-body hover:text-accent-purple-text hover:bg-accent-purple-bg rounded-lg px-3 py-2.5 text-sm font-medium transition-all"
                >
                  DM Tools
                </Link>
                <Link
                  href="/resources"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-body hover:text-accent-emerald-text hover:bg-accent-emerald-bg rounded-lg px-3 py-2.5 text-sm font-medium transition-all"
                >
                  Resources
                </Link>
                <div className="border-divider my-1 border-t" />
                <Button
                  variant="secondary"
                  size="sm"
                  fullWidth
                  rightIcon={<ArrowRight size={14} />}
                  asChild
                >
                  <Link href="/player" onClick={() => setMobileMenuOpen(false)}>
                    Get Started
                  </Link>
                </Button>
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* ── Hero ── */}
      <section
        ref={heroRef}
        className="relative flex min-h-[94vh] items-center overflow-hidden pt-16"
      >
        {/* Animated gradient mesh background */}
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
        >
          <GradientOrb
            className="animate-orb-float -top-20 -left-20 h-[500px] w-[500px] opacity-30 sm:h-[600px] sm:w-[600px]"
            color="radial-gradient(circle, var(--accent-blue-bg-strong) 0%, transparent 70%)"
          />
          <GradientOrb
            className="animate-orb-float-alt top-1/4 -right-32 h-[400px] w-[400px] opacity-25 sm:h-[550px] sm:w-[550px]"
            color="radial-gradient(circle, var(--accent-purple-bg-strong) 0%, transparent 70%)"
          />
          <GradientOrb
            className="animate-orb-float -bottom-20 left-1/3 h-[350px] w-[350px] opacity-20 sm:h-[500px] sm:w-[500px]"
            color="radial-gradient(circle, var(--accent-indigo-bg-strong) 0%, transparent 70%)"
          />
        </div>

        {/* Floating D&D icons — strong colors, no rotation, gentle drift */}
        <motion.div
          className="pointer-events-none absolute inset-0 overflow-hidden"
          aria-hidden="true"
          style={{ y: heroParallaxY, opacity: heroOpacity }}
        >
          <Dice6 className="text-accent-purple-text-muted animate-drift absolute top-[15%] left-[6%] h-14 w-14 opacity-40 sm:h-20 sm:w-20" />
          <Sword className="text-accent-blue-text-muted animate-drift-reverse absolute top-[25%] right-[8%] h-10 w-10 opacity-35 sm:h-16 sm:w-16" />
          <Shield className="text-accent-emerald-text-muted animate-drift-slow absolute bottom-[22%] left-[12%] h-12 w-12 opacity-30 sm:h-16 sm:w-16" />
          <Crown className="text-accent-amber-text-muted animate-drift absolute right-[14%] bottom-[16%] h-10 w-10 opacity-40 sm:h-14 sm:w-14" />
          <Star className="text-accent-indigo-text-muted animate-drift-reverse absolute top-[50%] left-[55%] h-8 w-8 opacity-25 sm:h-12 sm:w-12" />
          <BookOpen className="text-accent-red-text-muted animate-drift-slow absolute top-[65%] right-[25%] h-8 w-8 opacity-20 sm:h-10 sm:w-10" />
          <Sparkles className="text-accent-amber-text-muted animate-drift-reverse absolute top-[12%] left-[45%] h-6 w-6 opacity-30 sm:h-8 sm:w-8" />
        </motion.div>

        <div className="relative z-10 mx-auto max-w-5xl px-4 text-center sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            animate="visible"
            variants={fadeVariants}
            transition={{ duration: 0.8 }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mb-6"
            >
              <span className="bg-accent-purple-bg text-accent-purple-text border-accent-purple-border inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium shadow-sm">
                <Sparkles size={14} className="animate-icon-bob" />
                Free & open — no account required
              </span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="text-heading mb-6 text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-7xl"
            >
              Your Tabletop,{' '}
              <span className="animate-shimmer bg-linear-to-r from-blue-500 via-purple-500 to-indigo-500 bg-clip-text text-transparent">
                Supercharged
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="text-body mx-auto mb-10 max-w-2xl text-lg leading-relaxed sm:text-xl"
            >
              The all-in-one D&D 5e companion for players and dungeon masters.
              Smart character sheets, live campaign sync, and a complete
              reference library — all in your browser.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.55 }}
              className="flex flex-col items-center justify-center gap-4 sm:flex-row"
            >
              <motion.div
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
              >
                <Button
                  variant="secondary"
                  size="xl"
                  rightIcon={<ArrowRight size={18} />}
                  className="shadow-lg"
                  asChild
                >
                  <Link href="/player">Start as Player</Link>
                </Button>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
              >
                <Button
                  variant="outline"
                  size="xl"
                  rightIcon={<Crown size={18} />}
                  className="shadow-sm"
                  asChild
                >
                  <Link href="/dm">Start as DM</Link>
                </Button>
              </motion.div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.75 }}
              className="text-muted mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm"
            >
              <span className="flex items-center gap-1.5">
                <Lock size={14} />
                Data stays on your device
              </span>
              <span className="flex items-center gap-1.5">
                <Zap size={14} />
                Works offline
              </span>
              <span className="flex items-center gap-1.5">
                <Dice6 size={14} />
                3D dice rolling
              </span>
            </motion.div>
          </motion.div>
        </div>

        {/* Scroll hint */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.8 }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2"
        >
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
            className="text-faint flex flex-col items-center gap-1"
          >
            <span className="text-xs">Scroll</span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className="text-faint"
            >
              <path
                d="M4 6L8 10L12 6"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </motion.div>
        </motion.div>
      </section>

      {/* ── Feature Showcase ── */}
      <section className="relative overflow-hidden py-20 sm:py-28">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
        >
          <div className="bg-surface-secondary absolute inset-0" />
          <div className="landing-gradient-band-blue absolute inset-0 opacity-70" />
          <div className="landing-dot-grid absolute inset-0 opacity-30" />
          <GradientOrb
            className="animate-orb-float-alt top-[-10%] -left-20 h-[550px] w-[550px] opacity-50"
            color="radial-gradient(circle, var(--accent-blue-bg-strong) 0%, transparent 65%)"
          />
          <GradientOrb
            className="animate-orb-float -right-20 bottom-[-10%] h-[500px] w-[500px] opacity-40"
            color="radial-gradient(circle, var(--accent-emerald-bg-strong) 0%, transparent 65%)"
          />
        </div>

        <div className="relative z-10 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="mb-16 text-center">
            <h2 className="text-heading mb-4 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              Everything you need at the table
            </h2>
            <p className="text-body mx-auto max-w-2xl text-lg">
              Whether you&apos;re a first-time player or a veteran DM,
              RollKeeper has the tools to make your sessions smoother.
            </p>
          </AnimatedSection>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={landingStagger}
            className="grid grid-cols-1 gap-8 md:grid-cols-3"
          >
            {FEATURES.map(feature => (
              <motion.div key={feature.title} variants={landingItem}>
                <motion.div
                  whileHover={{ y: -6, transition: { duration: 0.25 } }}
                  className="h-full"
                >
                  <Card
                    className="relative h-full overflow-hidden border-none p-6 sm:p-8"
                    variant="elevated"
                  >
                    <div
                      className={`pointer-events-none absolute inset-0 bg-linear-to-br ${feature.gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
                    />
                    <CardContent className="relative flex flex-col items-start">
                      <motion.div
                        className={`${feature.bg} mb-5 flex h-14 w-14 items-center justify-center rounded-2xl`}
                        whileHover={{ scale: 1.1, rotate: 5 }}
                        transition={animationTransitions.spring}
                      >
                        <feature.icon className={`h-7 w-7 ${feature.accent}`} />
                      </motion.div>
                      <h3 className="text-heading mb-3 text-xl font-semibold">
                        {feature.title}
                      </h3>
                      <p className="text-body leading-relaxed">
                        {feature.description}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Player + DM Split ── */}
      <section className="relative overflow-hidden py-20 sm:py-28">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
        >
          <div className="landing-gradient-sweep absolute inset-0 opacity-60" />
          <GradientOrb
            className="animate-orb-float top-0 -left-10 h-[500px] w-[500px] opacity-45"
            color="radial-gradient(circle, var(--accent-blue-bg-strong) 0%, transparent 60%)"
          />
          <GradientOrb
            className="animate-orb-float-alt top-0 -right-10 h-[500px] w-[500px] opacity-45"
            color="radial-gradient(circle, var(--accent-purple-bg-strong) 0%, transparent 60%)"
          />
          <GradientOrb
            className="animate-orb-float bottom-0 left-1/2 h-[300px] w-[300px] -translate-x-1/2 opacity-30"
            color="radial-gradient(circle, var(--accent-indigo-bg-strong) 0%, transparent 65%)"
          />
        </div>

        <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="mb-16 text-center">
            <h2 className="text-heading mb-4 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              Built for both sides of the screen
            </h2>
            <p className="text-body mx-auto max-w-2xl text-lg">
              Dedicated dashboards for players and dungeon masters, each packed
              with the right tools.
            </p>
          </AnimatedSection>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
            {/* Player panel */}
            <AnimatedSection>
              <motion.div
                whileHover={{ y: -4, transition: { duration: 0.3 } }}
                className="bg-accent-blue-bg border-accent-blue-border relative h-full overflow-hidden rounded-2xl border p-8 sm:p-10"
              >
                <GradientOrb
                  className="animate-orb-float-alt -top-20 -right-20 h-[250px] w-[250px] opacity-40"
                  color="radial-gradient(circle, var(--accent-blue-bg-strong) 0%, transparent 70%)"
                />
                <div className="relative z-10">
                  <div className="mb-8 flex items-center gap-4">
                    <motion.div
                      className="bg-accent-blue-bg-strong flex h-14 w-14 items-center justify-center rounded-xl"
                      whileHover={{ scale: 1.1, rotate: -5 }}
                      transition={animationTransitions.spring}
                    >
                      <Users className="text-accent-blue-text h-7 w-7" />
                    </motion.div>
                    <div>
                      <h3 className="text-heading text-2xl font-bold">
                        For Players
                      </h3>
                      <p className="text-body text-sm">
                        Your characters, always ready
                      </p>
                    </div>
                  </div>

                  <ul className="mb-8 space-y-3">
                    {PLAYER_FEATURES.map((f, i) => (
                      <motion.li
                        key={f.text}
                        className="flex items-center gap-3"
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 + i * 0.08, duration: 0.4 }}
                      >
                        <div className="bg-accent-blue-bg-strong flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                          <f.icon className="text-accent-blue-text h-4 w-4" />
                        </div>
                        <span className="text-heading text-sm font-medium">
                          {f.text}
                        </span>
                      </motion.li>
                    ))}
                  </ul>

                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button
                      variant="secondary"
                      size="lg"
                      fullWidth
                      rightIcon={<ArrowRight size={16} />}
                      asChild
                    >
                      <Link href="/player">Open Player Dashboard</Link>
                    </Button>
                  </motion.div>
                </div>
              </motion.div>
            </AnimatedSection>

            {/* DM panel */}
            <AnimatedSection delay={0.15}>
              <motion.div
                whileHover={{ y: -4, transition: { duration: 0.3 } }}
                className="bg-accent-purple-bg border-accent-purple-border relative h-full overflow-hidden rounded-2xl border p-8 sm:p-10"
              >
                <GradientOrb
                  className="animate-orb-float -bottom-20 -left-20 h-[250px] w-[250px] opacity-40"
                  color="radial-gradient(circle, var(--accent-purple-bg-strong) 0%, transparent 70%)"
                />
                <div className="relative z-10">
                  <div className="mb-8 flex items-center gap-4">
                    <motion.div
                      className="bg-accent-purple-bg-strong flex h-14 w-14 items-center justify-center rounded-xl"
                      whileHover={{ scale: 1.1, rotate: 5 }}
                      transition={animationTransitions.spring}
                    >
                      <Crown className="text-accent-purple-text h-7 w-7" />
                    </motion.div>
                    <div>
                      <h3 className="text-heading text-2xl font-bold">
                        For Dungeon Masters
                      </h3>
                      <p className="text-body text-sm">
                        Run your campaign like a pro
                      </p>
                    </div>
                  </div>

                  <ul className="mb-8 space-y-3">
                    {DM_FEATURES.map((f, i) => (
                      <motion.li
                        key={f.text}
                        className="flex items-center gap-3"
                        initial={{ opacity: 0, x: -20 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.1 + i * 0.08, duration: 0.4 }}
                      >
                        <div className="bg-accent-purple-bg-strong flex h-8 w-8 shrink-0 items-center justify-center rounded-lg">
                          <f.icon className="text-accent-purple-text h-4 w-4" />
                        </div>
                        <span className="text-heading text-sm font-medium">
                          {f.text}
                        </span>
                      </motion.li>
                    ))}
                  </ul>

                  <motion.div
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button
                      variant="outline"
                      size="lg"
                      fullWidth
                      rightIcon={<ArrowRight size={16} />}
                      className="border-accent-purple-border-strong text-accent-purple-text hover:bg-accent-purple-bg-strong"
                      asChild
                    >
                      <Link href="/dm">Open DM Toolset</Link>
                    </Button>
                  </motion.div>
                </div>
              </motion.div>
            </AnimatedSection>
          </div>
        </div>
      </section>

      {/* ── Reference Tools ── */}
      <section className="relative overflow-hidden py-16 sm:py-24">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
        >
          <div className="bg-surface-secondary absolute inset-0" />
          <div className="landing-gradient-band-purple absolute inset-0 opacity-50" />
          <div className="landing-dot-grid absolute inset-0 opacity-20" />
          <GradientOrb
            className="animate-orb-float-alt top-[-20%] right-[-5%] h-[450px] w-[450px] opacity-50"
            color="radial-gradient(circle, var(--accent-indigo-bg-strong) 0%, transparent 60%)"
          />
          <GradientOrb
            className="animate-orb-float bottom-[-20%] left-[-5%] h-[400px] w-[400px] opacity-40"
            color="radial-gradient(circle, var(--accent-violet-bg-strong) 0%, transparent 60%)"
          />
        </div>

        <div className="relative z-10 mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="mb-12 text-center">
            <h2 className="text-heading mb-3 text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
              Reference Library
            </h2>
            <p className="text-body text-lg">
              Searchable compendiums you can pull up mid-session.
            </p>
          </AnimatedSection>

          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: '-60px' }}
            variants={landingStagger}
            className="grid grid-cols-1 gap-5 sm:grid-cols-3"
          >
            {REFERENCE_TOOLS.map(tool => (
              <motion.div key={tool.href} variants={landingItem}>
                <Link href={tool.href} className="group block">
                  <motion.div
                    whileHover={{ y: -4, scale: 1.02 }}
                    transition={{ duration: 0.25 }}
                  >
                    <Card
                      className={`${tool.border} ${tool.hoverBorder} border p-5 transition-all duration-300 group-hover:shadow-lg`}
                    >
                      <CardContent className="flex items-center gap-4">
                        <motion.div
                          className={`${tool.bg} flex h-12 w-12 shrink-0 items-center justify-center rounded-xl`}
                          whileHover={{ rotate: 10 }}
                          transition={animationTransitions.spring}
                        >
                          <tool.icon className={`h-6 w-6 ${tool.accent}`} />
                        </motion.div>
                        <div>
                          <h3 className="text-heading font-semibold">
                            {tool.title}
                          </h3>
                          <p className="text-muted text-sm">{tool.stat}</p>
                        </div>
                        <ArrowRight className="text-faint ml-auto h-4 w-4 transition-all duration-200 group-hover:translate-x-1 group-hover:text-current" />
                      </CardContent>
                    </Card>
                  </motion.div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Closing CTA ── */}
      <section className="relative overflow-hidden py-24 sm:py-32">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
        >
          <div className="landing-gradient-glow-center absolute inset-0 opacity-80" />
          <GradientOrb
            className="animate-orb-float top-[-10%] -left-10 h-[600px] w-[600px] opacity-50"
            color="radial-gradient(circle, var(--accent-blue-bg-strong) 0%, transparent 60%)"
          />
          <GradientOrb
            className="animate-orb-float-alt -right-10 bottom-[-10%] h-[600px] w-[600px] opacity-50"
            color="radial-gradient(circle, var(--accent-purple-bg-strong) 0%, transparent 60%)"
          />
          <GradientOrb
            className="animate-orb-float top-1/2 left-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 opacity-40"
            color="radial-gradient(circle, var(--accent-indigo-bg-strong) 0%, transparent 55%)"
          />
        </div>

        <div className="relative z-10 mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <AnimatedSection>
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Dice6 className="text-accent-purple-text mx-auto mb-6 h-14 w-14 sm:h-16 sm:w-16" />
            </motion.div>

            <h2 className="text-heading mb-4 text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
              Ready to roll?
            </h2>
            <p className="text-body mb-10 text-lg sm:text-xl">
              Jump in and start building your character or setting up your
              campaign. No sign-up, no setup — just open and play.
            </p>

            <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
              <motion.div
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
              >
                <Button
                  variant="secondary"
                  size="lg"
                  rightIcon={<ArrowRight size={16} />}
                  className="shadow-lg"
                  asChild
                >
                  <Link href="/player">Start as Player</Link>
                </Button>
              </motion.div>
              <motion.div
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
              >
                <Button
                  variant="outline"
                  size="lg"
                  rightIcon={<Crown size={16} />}
                  asChild
                >
                  <Link href="/dm">Start as DM</Link>
                </Button>
              </motion.div>
            </div>

            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="text-muted mt-8 flex items-center justify-center gap-2 text-sm"
            >
              <Lock size={14} />
              Your data stays on your device. No account needed.
            </motion.p>
          </AnimatedSection>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-divider bg-surface-secondary border-t py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center gap-6 sm:flex-row sm:justify-between">
            <div className="flex items-center gap-2">
              <Dice6 className="text-accent-purple-text h-5 w-5" />
              <span className="font-cinzel text-heading text-sm font-bold tracking-wide">
                RollKeeper
              </span>
            </div>

            <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
              <Link
                href="/player"
                className="text-muted hover:text-heading text-sm transition-colors"
              >
                Player Tools
              </Link>
              <Link
                href="/dm"
                className="text-muted hover:text-heading text-sm transition-colors"
              >
                DM Tools
              </Link>
              <Link
                href="/resources"
                className="text-muted hover:text-heading text-sm transition-colors"
              >
                Resources
              </Link>
            </nav>

            <p className="text-faint text-xs">
              Built by D&D players, for D&D players.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
