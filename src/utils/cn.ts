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
//
// The floating-layer shadow utility is a shadow size, so it conflicts with
// shadow-none and the other sizes, and a shadow colour such as
// shadow-black/20 doesn't replace it.
const twMerge = extendTailwindMerge<'type-scale'>({
  extend: {
    classGroups: {
      'type-scale': [{ type: [...TYPE_SCALE_STEPS] }],
      shadow: [{ shadow: ['overlay'] }],
    },
    conflictingClassGroups: {
      'type-scale': ['font-size', 'leading', 'font-weight', 'font-family'],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
