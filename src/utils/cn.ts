import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/** The Felt and Brass type-scale steps, rendered as `type-<step>` utilities. */
export const TYPE_SCALE_STEPS = [
  'title',
  'heading',
  'subheading',
  'label-heading',
  'body',
  'ui',
  'small',
  'caption',
  'num-xl',
  'num-lg',
  'num-md',
] as const;

// A later type-* class replaces an earlier one and any earlier size, line
// height, weight or family. A later text-*, leading-* or font-* class only
// overrides that one property, so type-* stays (Tailwind emits the type-*
// utilities first). Numeric variants such as tabular-nums are unrelated.
const twMerge = extendTailwindMerge<'type-scale'>({
  extend: {
    classGroups: {
      'type-scale': [{ type: [...TYPE_SCALE_STEPS] }],
    },
    conflictingClassGroups: {
      'type-scale': ['font-size', 'leading', 'font-weight', 'font-family'],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
