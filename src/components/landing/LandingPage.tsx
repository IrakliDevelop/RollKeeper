'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/forms/button';
import { AppHeader } from '@/components/ui/layout/AppHeader';
import { DemoInitiative } from './DemoInitiative';
import { DemoSheet } from './DemoSheet';
import { LandingSection } from './LandingSection';
import { LandingFooter } from './LandingFooter';
import { HERO_SUBLINE, STORAGE_LINE } from './landingCopy';
import { RoadmapTrail } from '@/components/roadmap/RoadmapTrail';
import type { RoadmapSection } from '@/lib/roadmap/parseRoadmap';

const NAV_LINKS = [
  { href: '/player', label: 'Characters' },
  { href: '/dm', label: 'Campaigns' },
  { href: '/resources', label: 'Rules reference' },
];

const REFERENCE_LINKS = [
  { href: '/spellbook', label: 'spells' },
  { href: '/bestiary', label: 'monsters' },
  { href: '/classes', label: 'classes' },
  { href: '/feats', label: 'feats' },
];

const LINK = 'text-heading underline underline-offset-2';

/** The way into the app: the two lists, which have their own create buttons. */
function EntryLinks({ primary = false }: { primary?: boolean }) {
  return (
    <div className="flex flex-wrap gap-3">
      <Button variant={primary ? 'primary' : 'secondary'} asChild>
        <Link href="/player">Your characters</Link>
      </Button>
      <Button asChild>
        <Link href="/dm">Your campaigns</Link>
      </Button>
    </div>
  );
}

interface LandingPageProps {
  /** The roadmap's "In progress" and "Next" sections, from `content/roadmap.md`. */
  roadmap: RoadmapSection[];
}

export function LandingPage({ roadmap }: LandingPageProps) {
  return (
    <div className="bg-surface text-body min-h-screen">
      <AppHeader
        title={null}
        nav={
          <nav aria-label="Main">
            <ul className="type-ui flex gap-5">
              {NAV_LINKS.map(link => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-body hover:text-heading inline-flex pointer-coarse:min-h-11 pointer-coarse:items-center"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        }
      />

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <section
          aria-labelledby="landing-title"
          className="grid items-start gap-8 py-8 sm:py-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-12 lg:py-16"
        >
          <div className="flex flex-col gap-5 lg:pt-4">
            <h1
              id="landing-title"
              className="type-display text-heading text-balance"
            >
              A D&amp;D 5e sheet that saves as you play.
            </h1>
            <p className="type-body text-body max-w-[34em]">{HERO_SUBLINE}</p>
            <EntryLinks primary />
            <p className="type-small text-muted max-w-[34em]">{STORAGE_LINE}</p>
          </div>
          <DemoSheet />
        </section>

        <div className="flex flex-col gap-12 pb-16">
          <LandingSection
            heading="Running a campaign"
            media={<DemoInitiative />}
          >
            <p>
              Give your players the campaign&apos;s join code. Their hit points,
              conditions and concentration show up in your initiative list as
              they play.
            </p>
            <p>
              Dice can stay physical: when you ask for initiative, players type
              in what they rolled.
            </p>
            <p className="type-small text-muted">
              A sample fight. Step through the turns or select a creature.
            </p>
          </LandingSection>

          <LandingSection
            heading="The battle map on the table"
            media={
              <figure className="flex flex-col gap-2">
                <Image
                  src="/landing/battle-map.webp"
                  width={1600}
                  height={1003}
                  sizes="(min-width: 1024px) 58vw, 100vw"
                  alt="Battle map on the table's shared screen: two players on a bridge between ruined temple wings, three monsters in the courtyard below inside a 20-foot spell area, and fog over the unexplored east wing"
                  className="border-divider rounded-md border"
                />
                <figcaption className="type-caption text-muted">
                  Map:{' '}
                  <a
                    href="https://dysonlogos.blog/2015/03/20/friday-map-the-temple-complex-ruins/"
                    className="underline underline-offset-2"
                  >
                    Temple Complex Ruins
                  </a>{' '}
                  by Dyson Logos,{' '}
                  <a
                    href="https://creativecommons.org/licenses/by/4.0/"
                    className="underline underline-offset-2"
                  >
                    CC BY 4.0
                  </a>
                  ; cropped and colours adjusted.
                </figcaption>
              </figure>
            }
          >
            <p>
              Put the map on a TV or a second monitor in the middle of the
              table. Tokens come from your encounter, spell areas show their
              real size, and fog lifts only where you paint it away.
            </p>
            <p>
              Players can set their miniatures on top of the tokens, or open the
              same map on their own phones.
            </p>
          </LandingSection>

          <LandingSection heading="Your character, without a DM">
            <p>
              You don&apos;t need a campaign. Pick the 2014 or the 2024 layout;
              the sheet works out your modifiers, walks you through each level
              and has virtual dice whose results stay on your screen.
            </p>
            <p>
              Look up{' '}
              {REFERENCE_LINKS.map((link, i) => (
                <span key={link.href}>
                  {i > 0 && (i === REFERENCE_LINKS.length - 1 ? ' and ' : ', ')}
                  <Link href={link.href} className={LINK}>
                    {link.label}
                  </Link>
                </span>
              ))}{' '}
              in the rules reference.
            </p>
          </LandingSection>

          {roadmap.length > 0 && (
            <LandingSection heading="What's next">
              <RoadmapTrail sections={roadmap} headingLevel={3} />
              <p>
                <Link href="/roadmap" className={LINK}>
                  See the whole roadmap
                </Link>
              </p>
            </LandingSection>
          )}

          <div className="border-divider border-t pt-10">
            <EntryLinks />
          </div>
        </div>
      </main>

      <LandingFooter links={NAV_LINKS} />
    </div>
  );
}
