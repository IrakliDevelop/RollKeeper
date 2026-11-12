'use client';

import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/forms/button';
import { AppHeader } from '@/components/ui/layout/AppHeader';

export interface CampaignHeaderCrumb {
  href: string;
  label: string;
}

interface CampaignHeaderProps {
  crumb?: CampaignHeaderCrumb;
  title: ReactNode;
  actions?: ReactNode;
  wrapControls?: boolean;
}

/** Shared header for the DM campaign routes: back crumb, title, actions. */
export function CampaignHeader({
  crumb,
  title,
  actions,
  wrapControls,
}: CampaignHeaderProps) {
  return (
    <AppHeader
      wrapControls={wrapControls}
      leading={
        crumb ? (
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="shrink-0 px-2 whitespace-nowrap sm:px-4"
            leftIcon={<ArrowLeft size={20} aria-hidden />}
          >
            <Link href={crumb.href}>
              <span className="sr-only sm:not-sr-only sm:block sm:max-w-48 sm:truncate">
                {crumb.label}
              </span>
            </Link>
          </Button>
        ) : undefined
      }
      title={title}
      actions={actions}
    />
  );
}
