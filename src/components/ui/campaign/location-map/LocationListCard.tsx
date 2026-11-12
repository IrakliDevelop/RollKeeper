'use client';

import React from 'react';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { confirmDialog } from '@/components/ui/feedback/confirm-dialog';
import type { LocationMap } from '@/types/location';

interface LocationListCardProps {
  location: LocationMap;
  campaignCode: string;
  onDelete: (id: string) => void;
}

export function LocationListCard({
  location,
  campaignCode,
  onDelete,
}: LocationListCardProps) {
  async function handleDelete() {
    const confirmed = await confirmDialog({
      title: `Delete ${location.name}?`,
      message:
        'The map and everything drawn on it are removed from this campaign and from your players.',
      confirmLabel: 'Delete location',
      tone: 'danger',
    });
    if (confirmed) onDelete(location.id);
  }

  return (
    <div className="bg-surface-raised border-divider relative overflow-hidden rounded-md border">
      <Link
        href={`/dm/campaign/${campaignCode}/locations/${location.id}`}
        className="focus-visible:ring-brass-fill block focus-visible:ring-2 focus-visible:outline-none"
      >
        <div className="bg-surface-secondary h-40 w-full">
          {location.mapImageUrl ? (
            <img
              src={location.mapImageUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="type-small text-muted flex h-full w-full items-center justify-center">
              No image
            </div>
          )}
        </div>
        <div className="flex items-center px-3 py-2 pr-14 pointer-coarse:min-h-11">
          <p className="type-ui text-heading truncate">{location.name}</p>
        </div>
      </Link>
      <Button
        variant="danger"
        size="sm"
        aria-label={`Delete ${location.name}`}
        onClick={handleDelete}
        className="absolute right-2 bottom-1.5 pointer-coarse:min-h-11 pointer-coarse:min-w-11"
      >
        <Trash2 size={14} aria-hidden="true" />
      </Button>
    </div>
  );
}

export default LocationListCard;
