'use client';

import React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Book,
  Users,
  Scroll,
  Skull,
  Library,
  Dice6,
} from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Badge } from '@/components/ui/layout/badge';
import { Card, CardContent } from '@/components/ui/layout/card';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

interface ResourceItem {
  title: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accentBg: string;
  accentText: string;
  accentBorder: string;
  iconContainerClass: string;
  available: boolean;
  comingSoon?: boolean;
}

const resourceItems: ResourceItem[] = [
  {
    title: 'Spellbook',
    description:
      '540+ D&D spells with advanced search, filtering by school, level, and class',
    href: '/spellbook',
    icon: Book,
    accentBg: 'bg-accent-purple-bg',
    accentText: 'text-accent-purple-text',
    accentBorder: 'border-accent-purple-border',
    iconContainerClass: 'bg-accent-purple-bg-strong text-accent-purple-text',
    available: true,
  },
  {
    title: 'Classes',
    description:
      'Complete compendium of all D&D classes, subclasses, and progression tables',
    href: '/classes',
    icon: Users,
    accentBg: 'bg-accent-emerald-bg',
    accentText: 'text-accent-emerald-text',
    accentBorder: 'border-accent-emerald-border',
    iconContainerClass: 'bg-accent-emerald-bg-strong text-accent-emerald-text',
    available: true,
  },
  {
    title: 'Feats',
    description: 'Browse and manage character feats and special abilities',
    href: '/feats',
    icon: Scroll,
    accentBg: 'bg-accent-amber-bg',
    accentText: 'text-accent-amber-text',
    accentBorder: 'border-accent-amber-border',
    iconContainerClass: 'bg-accent-amber-bg-strong text-accent-amber-text',
    available: true,
  },
  {
    title: 'Bestiary',
    description:
      'Full monster database with stat blocks, search, and CR filtering',
    href: '/bestiary',
    icon: Skull,
    accentBg: 'bg-accent-red-bg',
    accentText: 'text-accent-red-text',
    accentBorder: 'border-accent-red-border',
    iconContainerClass: 'bg-accent-red-bg-strong text-accent-red-text',
    available: true,
  },
];

export default function ResourcesPage() {
  return (
    <div className="bg-surface min-h-screen">
      {/* Header */}
      <header className="bg-surface/80 border-divider sticky top-0 z-30 border-b backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="text-muted hover:text-heading flex items-center gap-2 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden font-medium sm:inline">Home</span>
              </Link>
              <div className="bg-divider h-6 w-px" />
              <div className="flex items-center gap-3">
                <div className="bg-accent-purple-bg-strong rounded-lg p-2">
                  <Library className="text-accent-purple-text h-5 w-5" />
                </div>
                <h1 className="text-heading text-lg font-bold sm:text-xl">
                  D&D Resources
                </h1>
              </div>
            </div>
            <nav className="flex items-center gap-1 sm:gap-2">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/player">Player</Link>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/dm">DM Tools</Link>
              </Button>
              <div className="bg-divider mx-1 h-5 w-px sm:mx-2" />
              <ThemeToggle />
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        {/* Hero Section */}
        <div className="mb-10 text-center sm:mb-14">
          <div className="mb-4 inline-flex items-center gap-2">
            <Dice6 className="text-accent-purple-text h-5 w-5" />
            <span className="text-muted text-sm font-medium tracking-wider uppercase">
              Reference Library
            </span>
          </div>
          <h2 className="text-heading mb-4 text-3xl font-bold sm:text-4xl">
            Complete D&D Reference Library
          </h2>
          <p className="text-body mx-auto max-w-2xl text-base sm:text-lg">
            Comprehensive resources, tools, and databases to enhance your
            tabletop experience. Everything you need, right at your fingertips.
          </p>
        </div>

        {/* Resources Grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">
          {resourceItems.map(item => {
            const IconComponent = item.icon;

            if (!item.available) {
              return (
                <Card
                  key={item.title}
                  variant="bordered"
                  padding="lg"
                  className="relative opacity-60"
                >
                  <CardContent className="p-0">
                    <div className="mb-4 flex items-center justify-between">
                      <div
                        className={`rounded-xl p-3 ${item.iconContainerClass} opacity-50 grayscale`}
                      >
                        <IconComponent className="h-6 w-6" />
                      </div>
                      {item.comingSoon && (
                        <Badge variant="warning" size="sm">
                          Coming Soon
                        </Badge>
                      )}
                    </div>
                    <h3 className="text-heading mb-2 text-lg font-semibold">
                      {item.title}
                    </h3>
                    <p className="text-muted text-sm">{item.description}</p>
                  </CardContent>
                </Card>
              );
            }

            return (
              <Link
                key={item.title}
                href={item.href}
                className="group focus-visible:ring-ring block rounded-xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <Card
                  variant="bordered"
                  padding="lg"
                  className={`h-full transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-lg group-hover:${item.accentBorder} group-focus-within:-translate-y-1 group-focus-within:shadow-lg`}
                >
                  <CardContent className="p-0">
                    <div className="mb-4 flex items-center justify-between">
                      <div
                        className={`rounded-xl p-3 transition-transform duration-300 group-hover:scale-110 ${item.iconContainerClass}`}
                      >
                        <IconComponent className="h-6 w-6" />
                      </div>
                      <div
                        className={`flex items-center gap-1 ${item.accentText} text-sm font-medium opacity-0 transition-opacity duration-300 group-hover:opacity-100 max-sm:opacity-100 sm:group-focus-within:opacity-100`}
                      >
                        <span>Explore</span>
                        <ArrowRight className="h-4 w-4" />
                      </div>
                    </div>
                    <h3 className="text-heading mb-2 text-lg font-semibold">
                      {item.title}
                    </h3>
                    <p className="text-muted text-sm">{item.description}</p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        {/* Coming Soon Section */}
        <Card variant="bordered" padding="lg" className="mt-12 sm:mt-16">
          <CardContent className="p-0 text-center">
            <h3 className="text-heading mb-3 text-xl font-bold sm:text-2xl">
              More Resources Coming Soon
            </h3>
            <p className="text-body mb-6">
              We&apos;re constantly expanding our collection of D&D tools and
              resources.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Badge variant="neutral" size="md">
                Equipment Database
              </Badge>
              <Badge variant="neutral" size="md">
                Encounter Builder
              </Badge>
              <Badge variant="neutral" size="md">
                Random Generators
              </Badge>
              <Badge variant="neutral" size="md">
                Campaign Tools
              </Badge>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
