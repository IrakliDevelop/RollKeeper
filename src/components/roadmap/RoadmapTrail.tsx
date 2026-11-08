'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/utils/cn';
import type { RoadmapSection } from '@/lib/roadmap/parseRoadmap';

/** Where a section sits on the route, relative to the "In progress" stop. */
type Stage = 'travelled' | 'here' | 'ahead' | 'unmapped';

const HERE = 'In progress';
const UNMAPPED = 'Not built yet';

function stageOf(sections: RoadmapSection[], index: number): Stage {
  const heading = sections[index].heading;
  if (heading === UNMAPPED) return 'unmapped';
  const here = sections.findIndex(s => s.heading === HERE);
  if (index === here) return 'here';
  return here !== -1 && index < here ? 'travelled' : 'ahead';
}

const TRAIL_WIDTH = 88;
// The route swings between these two x positions, like a road on a map.
const SWING = [22, 66];
// A long stretch between two stops gets an extra bend every this many px.
const BEND_EVERY = 130;

interface Stop {
  y: number;
  stage: Stage;
}

type Point = { x: number; y: number };

/**
 * The road from one stop to the next: an S-bend for every BEND_EVERY px,
 * swinging from side to side and arriving at the next stop's x.
 */
function stretchPath(from: Point, to: Point): string {
  const bends = Math.max(1, Math.round((to.y - from.y) / BEND_EVERY));
  const step = (to.y - from.y) / bends;
  let d = `M ${from.x} ${from.y}`;
  let prev = from;
  for (let i = 1; i <= bends; i++) {
    const next =
      i === bends
        ? to
        : {
            x: prev.x === SWING[0] ? SWING[1] : SWING[0],
            y: from.y + step * i,
          };
    const mid = (prev.y + next.y) / 2;
    d += ` C ${prev.x} ${mid}, ${next.x} ${mid}, ${next.x} ${next.y}`;
    prev = next;
  }
  return d;
}

const SEGMENT_STYLE: Record<Stage, { className: string; dash?: string }> = {
  travelled: { className: 'text-heading' },
  here: { className: 'text-heading' },
  ahead: { className: 'text-muted', dash: '10 9' },
  unmapped: { className: 'text-faint', dash: '0.1 11' },
};

function Marker({ x, y, stage }: Stop & { x: number }) {
  if (stage === 'here') {
    return (
      <g className="text-brass-text">
        <circle cx={x} cy={y} r={17} fill="var(--color-surface)" />
        <circle
          cx={x}
          cy={y}
          r={15}
          fill="none"
          stroke="currentColor"
          strokeWidth={3.5}
        />
        <circle cx={x} cy={y} r={6.5} fill="currentColor" />
      </g>
    );
  }
  if (stage === 'travelled') {
    return (
      <g className="text-heading">
        <circle cx={x} cy={y} r={11} fill="var(--color-surface)" />
        <circle cx={x} cy={y} r={8} fill="currentColor" />
      </g>
    );
  }
  return (
    <circle
      cx={x}
      cy={y}
      r={9}
      className={stage === 'unmapped' ? 'text-faint' : 'text-muted'}
      fill="var(--color-surface)"
      stroke="currentColor"
      strokeWidth={3}
    />
  );
}

interface RoadmapTrailProps {
  sections: RoadmapSection[];
  /** Heading level for section titles; the page owns the h1. */
  headingLevel?: 2 | 3;
}

/**
 * The roadmap drawn as a route: built stops on a solid line, a brass
 * "you are here" ring at the section in progress, dashed road ahead and a
 * dotted line where the map runs out. The list stays readable without the
 * drawing (it is aria-hidden and only added once the layout is measured).
 */
export function RoadmapTrail({
  sections,
  headingLevel = 2,
}: RoadmapTrailProps) {
  const listRef = useRef<HTMLOListElement>(null);
  const [stops, setStops] = useState<Stop[]>([]);
  const [height, setHeight] = useState(0);
  const Heading = headingLevel === 2 ? 'h2' : 'h3';

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = () => {
      const top = list.getBoundingClientRect().top;
      const anchors = list.querySelectorAll<HTMLElement>('[data-trail-anchor]');
      setStops(
        [...anchors].map((anchor, i) => {
          const r = anchor.getBoundingClientRect();
          return { y: r.top - top + r.height / 2, stage: stageOf(sections, i) };
        })
      );
      setHeight(list.getBoundingClientRect().height);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [sections]);

  const placed = stops.map((stop, i) => ({ ...stop, x: SWING[i % 2] }));
  const last = placed[placed.length - 1];

  return (
    <div className="relative">
      {placed.length > 0 && (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0"
          width={TRAIL_WIDTH}
          height={height}
        >
          {placed.slice(1).map((stop, i) => {
            const style =
              SEGMENT_STYLE[stop.stage === 'here' ? 'travelled' : stop.stage];
            return (
              <path
                key={sections[i + 1].heading}
                d={stretchPath(placed[i], stop)}
                fill="none"
                stroke="currentColor"
                strokeWidth={4}
                strokeLinecap="round"
                strokeDasharray={style.dash}
                className={style.className}
              />
            );
          })}
          {last?.stage === 'unmapped' && (
            <path
              d={`M ${last.x} ${last.y} L ${last.x} ${height}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={4}
              strokeLinecap="round"
              strokeDasharray="0.1 11"
              className="text-faint"
            />
          )}
          {placed.map(stop => (
            <Marker key={`${stop.y}-${stop.stage}`} {...stop} />
          ))}
        </svg>
      )}
      <ol ref={listRef} className="flex flex-col gap-10">
        {sections.map((section, i) => {
          const stage = stageOf(sections, i);
          return (
            <li key={section.heading} style={{ paddingLeft: TRAIL_WIDTH + 8 }}>
              <div
                data-trail-anchor=""
                className="flex flex-wrap items-baseline gap-x-3"
              >
                <Heading
                  className={cn(
                    'type-heading',
                    stage === 'unmapped' ? 'text-muted' : 'text-heading'
                  )}
                >
                  {section.heading}
                </Heading>
                {stage === 'here' && (
                  <span className="type-small text-brass-text">
                    You are here
                  </span>
                )}
              </div>
              <ul
                className={cn(
                  'type-body mt-3 flex flex-col gap-2',
                  stage === 'unmapped' ? 'text-muted' : 'text-body'
                )}
              >
                {section.items.map(item => (
                  <li key={item.text}>
                    {item.href ? (
                      <Link
                        href={item.href}
                        className="text-heading underline underline-offset-2"
                      >
                        {item.text}
                      </Link>
                    ) : (
                      item.text
                    )}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
