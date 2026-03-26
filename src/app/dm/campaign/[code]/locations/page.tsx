'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, MapPinned, Plus } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/feedback/dialog';
import { LocationListCard } from '@/components/ui/campaign/location-map/LocationListCard';
import { useLocationStore, generateLocationId } from '@/store/locationStore';
import { useHydration } from '@/hooks/useHydration';
import { useDmStore } from '@/store/dmStore';

export default function CampaignLocationsPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;
  const hasHydrated = useHydration();
  const { getCampaign, dmId } = useDmStore();
  const campaign = getCampaign(code);
  const { getLocations, addLocation, removeLocation } = useLocationStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [locationName, setLocationName] = useState('');
  const [mapFile, setMapFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const locations = hasHydrated ? getLocations(code) : [];

  function handleDialogClose(open: boolean) {
    if (!open) {
      setLocationName('');
      setMapFile(null);
      setUploadError('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
    setDialogOpen(open);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!locationName.trim() || !mapFile) return;

    setUploading(true);
    setUploadError('');

    try {
      const assetId = generateLocationId();
      const formData = new FormData();
      formData.append('file', mapFile);
      formData.append('assetId', assetId);

      const res = await fetch('/api/assets/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        throw new Error('Upload failed');
      }

      const { url } = (await res.json()) as { url: string };

      // Get image dimensions
      const { w, h } = await new Promise<{ w: number; h: number }>(
        (resolve, reject) => {
          const img = new Image();
          img.onload = () =>
            resolve({ w: img.naturalWidth, h: img.naturalHeight });
          img.onerror = reject;
          img.src = url;
        }
      );

      const newId = generateLocationId();
      addLocation(code, {
        id: newId,
        campaignCode: code,
        name: locationName.trim(),
        mapImageUrl: url,
        mapImageSize: { w, h },
        canvasState: '',
        dmOnlyElements: {},
        gridEnabled: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setDialogOpen(false);
      router.push(`/dm/campaign/${code}/locations/${newId}`);
    } catch {
      setUploadError('Failed to upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  }

  if (!hasHydrated) {
    return (
      <div className="bg-surface flex min-h-screen items-center justify-center">
        <div className="text-muted animate-pulse">Loading...</div>
      </div>
    );
  }

  return (
    <div className="bg-surface min-h-screen">
      <header className="border-divider bg-surface-secondary border-b shadow-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center">
              <Link href={`/dm/campaign/${code}`}>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<ArrowLeft size={20} />}
                >
                  {campaign?.name ?? 'Campaign'}
                </Button>
              </Link>
              <div className="ml-6 flex items-center">
                <MapPinned className="text-accent-emerald-text mr-3 h-6 w-6" />
                <h1 className="text-heading text-xl font-bold">Locations</h1>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
                <DialogTrigger asChild>
                  <Button
                    variant="primary"
                    size="sm"
                    leftIcon={<Plus size={16} />}
                  >
                    New Location
                  </Button>
                </DialogTrigger>
                <DialogContent size="sm">
                  <DialogHeader>
                    <DialogTitle>New Location</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit}>
                    <DialogBody className="flex flex-col gap-4 px-6 pt-4">
                      <div>
                        <label className="text-body mb-1.5 block text-sm font-medium">
                          Location Name
                        </label>
                        <Input
                          value={locationName}
                          onChange={e => setLocationName(e.target.value)}
                          placeholder="e.g. Tavern, Dungeon Level 1"
                          required
                          autoFocus
                        />
                      </div>
                      <div>
                        <label className="text-body mb-1.5 block text-sm font-medium">
                          Map Image
                        </label>
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          className={`border-divider bg-surface hover:border-body flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-4 py-6 transition-colors ${
                            mapFile ? 'border-accent-emerald-border' : ''
                          }`}
                        >
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            required
                            onChange={e =>
                              setMapFile(e.target.files?.[0] ?? null)
                            }
                            className="hidden"
                          />
                          {mapFile ? (
                            <div className="flex flex-col items-center gap-1">
                              <MapPinned
                                size={24}
                                className="text-accent-emerald-text"
                              />
                              <span className="text-body text-sm font-medium">
                                {mapFile.name}
                              </span>
                              <span className="text-muted text-xs">
                                Click to change
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center gap-1">
                              <Plus size={24} className="text-muted" />
                              <span className="text-body text-sm font-medium">
                                Choose an image
                              </span>
                              <span className="text-muted text-xs">
                                PNG, JPG, or WebP
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                      {uploadError && (
                        <p className="text-accent-red-text text-sm">
                          {uploadError}
                        </p>
                      )}
                    </DialogBody>
                    <DialogFooter className="mt-4">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => handleDialogClose(false)}
                        disabled={uploading}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        variant="primary"
                        disabled={uploading || !locationName.trim() || !mapFile}
                      >
                        {uploading ? 'Uploading...' : 'Create Location'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
              <ThemeToggle showSystemOption />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {locations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <MapPinned className="text-muted mb-4 h-12 w-12" />
            <p className="text-heading mb-1 text-lg font-semibold">
              No locations yet
            </p>
            <p className="text-muted text-sm">Upload a map to get started.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {locations.map(location => (
              <LocationListCard
                key={location.id}
                location={location}
                campaignCode={code}
                onDelete={id => {
                  removeLocation(code, id);
                  // Also remove from Redis so players no longer see it
                  fetch(`/api/campaign/${code}/locations/${id}`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dmId }),
                  }).catch(() => {
                    // Best-effort — local delete already happened
                  });
                }}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
