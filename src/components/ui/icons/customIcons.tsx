import { forwardRef } from 'react';
import {
  createLucideIcon,
  type LucideIcon,
  type LucideProps,
} from 'lucide-react';

/** Lucide's Germ icon, included locally until the pinned package exports it. */
export const GermIcon = createLucideIcon('germ', [
  ['path', { d: 'm11 2 .925 1.848', key: '1h25bb' }],
  ['path', { d: 'M13 15h.01', key: '11p6kq' }],
  ['path', { d: 'm16 21-1-2.472', key: '1jpmg8' }],
  ['path', { d: 'm19 2-1 1.804', key: '1v9d6m' }],
  ['path', { d: 'm2 19 2.746-1.373', key: '1c1p4s' }],
  ['path', { d: 'm22 16-2.474-2.13', key: '1azmv9' }],
  ['path', { d: 'm22 5-1.804 1', key: '1kxw7j' }],
  ['path', { d: 'm3 10 2 2', key: '4xslx3' }],
  ['path', { d: 'M9 16h.01', key: '1z6y7g' }],
  ['path', { d: 'M9 20v2', key: '1p6o0j' }],
  [
    'path',
    {
      d: 'M9.33 7.035c-.51 1.478-1.786 2.93-3.09 3.794A5 5 0 009 20a12.1 12.1 0 0011.902-9.916A6 6 0 009.33 7.035',
      key: 'qtdqii',
    },
  ],
  ['circle', { cx: '15', cy: '9', r: '2', key: '14p4hk' }],
]);

/** Custom exception: Lucide does not include a wizard-hat/level-up glyph. */
export const LevelUpIcon = forwardRef<SVGSVGElement, LucideProps>(
  ({ size = 24, color = 'currentColor', ...props }, ref) => (
    <svg
      ref={ref}
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill={color}
      {...props}
    >
      <path d="M496 448H16c-8.84 0-16 7.16-16 16v32c0 8.84 7.16 16 16 16h480c8.84 0 16-7.16 16-16v-32c0-8.84-7.16-16-16-16zm-304-64l-64-32 64-32 32-64 32 64 64 32-64 32-16 32h208l-86.41-201.63a63.955 63.955 0 0 1-1.89-45.45L416 0 228.42 107.19a127.989 127.989 0 0 0-53.46 59.15L64 416h144l-16-32zm64-224l16-32 16 32 32 16-32 16-16 32-16-32-32-16 32-16z" />
    </svg>
  )
) as LucideIcon;

LevelUpIcon.displayName = 'LevelUpIcon';
