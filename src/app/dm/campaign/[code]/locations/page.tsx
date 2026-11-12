'use client';

import React, { useId, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import { CampaignHeader } from '@/components/ui/campaign/CampaignHeader';
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
import { uploadAsset } from '@/utils/uploadAsset';

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
  const imgLabelId = useId();

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
      const url = await uploadAsset(mapFile, assetId);

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
      setUploadError("Couldn't upload the map. Check the image and try again.");
    } finally {
      setUploading(false);
    }
  }

  if (!hasHydrated) {
    return (
      <div className="bg-surface flex min-h-screen items-center justify-center">
        <p className="text-muted">Loading locations…</p>
      </div>
    );
  }

  return (
    <div className="bg-surface min-h-screen">
      <CampaignHeader
        crumb={{
          href: `/dm/campaign/${code}`,
          label: campaign?.name ?? 'Campaign',
        }}
        title={<h1 className="type-heading text-heading">Locations</h1>}
        actions={
          <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
            <DialogTrigger asChild>
              <Button variant="primary" size="sm" leftIcon={<Plus size={16} />}>
                New location
              </Button>
            </DialogTrigger>
            <DialogContent size="sm">
              <DialogHeader>
                <DialogTitle>New location</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <DialogBody className="flex flex-col gap-4">
                  <Input
                    label="Name"
                    value={locationName}
                    onChange={e => setLocationName(e.target.value)}
                    placeholder="The Yawning Portal"
                    required
                    autoFocus
                  />
                  <div>
                    <span
                      id={imgLabelId}
                      className="text-heading mb-1.5 block text-sm font-medium"
                    >
                      Map image
                    </span>
                    <div
                      role="group"
                      aria-labelledby={imgLabelId}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        {mapFile ? 'Change image' : 'Choose image'}
                      </Button>
                      {mapFile && (
                        <p className="type-small text-muted">{mapFile.name}</p>
                      )}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        tabIndex={-1}
                        aria-hidden="true"
                        onChange={e => setMapFile(e.target.files?.[0] ?? null)}
                      />
                    </div>
                  </div>
                  {uploadError && (
                    <p role="alert" className="type-small text-blood-text">
                      {uploadError}
                    </p>
                  )}
                </DialogBody>
                <DialogFooter>
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
                    loading={uploading}
                    disabled={uploading || !locationName.trim() || !mapFile}
                  >
                    {uploading ? 'Uploading…' : 'Create location'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {locations.length === 0 ? (
          <div className="py-12 text-center">
            <p className="type-subheading text-heading">
              Add your first location
            </p>
            <p className="type-body text-muted mt-2">
              Upload a map image to mark up and share with your players.
            </p>
            <Button className="mt-4" onClick={() => setDialogOpen(true)}>
              New location
            </Button>
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
