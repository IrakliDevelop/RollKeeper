import type { ComponentProps } from 'react';
import { ICONS, type IconName } from './iconRegistry';

export interface AppIconProps
  extends Omit<ComponentProps<'svg'>, 'children' | 'name'> {
  name: IconName;
  label?: string;
  size?: number | string;
  strokeWidth?: number | string;
}

export function AppIcon({ name, label, ...props }: AppIconProps) {
  const Icon = ICONS[name];

  return (
    <Icon
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
      {...props}
    />
  );
}
