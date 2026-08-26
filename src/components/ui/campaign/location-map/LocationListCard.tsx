'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
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
  const [confirmDelete, setConfirmDelete] = useState(false);

  function handleDeleteClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (confirmDelete) {
      onDelete(location.id);
    } else {
      setConfirmDelete(true);
    }
  }

  function handleCancelDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setConfirmDelete(false);
  }

  return (
    <Link
      href={`/dm/campaign/${campaignCode}/locations/${location.id}`}
      className="block"
    >
      <div className="bg-surface-raised border-divider group relative overflow-hidden rounded-lg border shadow-sm transition-shadow hover:shadow-md">
        {/* Map image thumbnail */}
        <div className="bg-surface-secondary relative h-40 w-full overflow-hidden">
          {location.mapImageUrl ? (
            <img
              src={location.mapImageUrl}
              alt={location.name}
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
            />
          ) : (
            <div className="text-muted flex h-full w-full items-center justify-center text-sm">
              No image
            </div>
          )}

          {/* Delete button — top-right corner */}
          <div className="absolute top-2 right-2 flex items-center gap-1">
            {confirmDelete ? (
              <>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={handleDeleteClick}
                  className="h-7 px-2 text-xs"
                >
                  Delete
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCancelDelete}
                  className="h-7 px-2 text-xs"
                >
                  Cancel
                </Button>
              </>
            ) : (
              <button
                onClick={handleDeleteClick}
                title="Delete location"
                className="border-divider bg-surface/80 text-muted hover:text-accent-red-text flex h-7 w-7 items-center justify-center rounded-md border shadow-sm backdrop-blur-sm transition-colors"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Location name overlay at bottom */}
        <div className="bg-surface-raised border-divider border-t px-3 py-2">
          <p className="text-heading truncate text-sm font-semibold">
            {location.name}
          </p>
        </div>
      </div>
    </Link>
  );
}

export default LocationListCard;
