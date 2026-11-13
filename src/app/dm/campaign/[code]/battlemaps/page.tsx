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
import { BattleMapListCard } from '@/components/ui/campaign/battle-map/BattleMapListCard';
import { useBattleMapStore, generateBattleMapId } from '@/store/battleMapStore';
import { useHydration } from '@/hooks/useHydration';
import { useDmStore } from '@/store/dmStore';
import { uploadAsset } from '@/utils/uploadAsset';

export default function CampaignBattleMapsPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;
  const hasHydrated = useHydration();
  const { getCampaign, dmId } = useDmStore();
  const campaign = getCampaign(code);
  const { getBattleMaps, addBattleMap, removeBattleMap } = useBattleMapStore();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [mapName, setMapName] = useState('');
  const [mapFile, setMapFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imgLabelId = useId();

  const battleMaps = hasHydrated ? getBattleMaps(code) : [];

  function handleDialogClose(open: boolean) {
    if (!open) {
      setMapName('');
      setMapFile(null);
      setUploadError('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
    setDialogOpen(open);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mapName.trim() || !mapFile) return;

    setUploading(true);
    setUploadError('');

    try {
      const assetId = generateBattleMapId();
      const url = await uploadAsset(mapFile, assetId);

      const { w, h } = await new Promise<{ w: number; h: number }>(
        (resolve, reject) => {
          const img = new Image();
          img.onload = () =>
            resolve({ w: img.naturalWidth, h: img.naturalHeight });
          img.onerror = reject;
          img.src = url;
        }
      );

      const newId = generateBattleMapId();
      addBattleMap(code, {
        id: newId,
        campaignCode: code,
        name: mapName.trim(),
        mapImageUrl: url,
        mapImageSize: { w, h },
        canvasState: '',
        dmOnlyElements: {},
        gridEnabled: false,
        linkedEncounterIds: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setDialogOpen(false);
      router.push(`/dm/campaign/${code}/battlemaps/${newId}`);
    } catch {
      setUploadError("Couldn't upload the map. Check the image and try again.");
    } finally {
      setUploading(false);
    }
  }

  if (!hasHydrated) {
    return (
      <div className="bg-surface flex min-h-screen items-center justify-center">
        <p className="text-muted">Loading battle maps…</p>
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
        title={<h1 className="type-heading text-heading">Battle maps</h1>}
        actions={
          <Dialog open={dialogOpen} onOpenChange={handleDialogClose}>
            <DialogTrigger asChild>
              <Button variant="primary" size="sm" leftIcon={<Plus size={16} />}>
                New battle map
              </Button>
            </DialogTrigger>
            <DialogContent size="sm">
              <DialogHeader>
                <DialogTitle>New battle map</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <DialogBody className="flex flex-col gap-4">
                  <Input
                    label="Name"
                    value={mapName}
                    onChange={e => setMapName(e.target.value)}
                    placeholder="Goblin ambush"
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
                        <p className="type-small text-muted max-w-full min-w-0 truncate">
                          {mapFile.name}
                        </p>
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
                    disabled={uploading || !mapName.trim() || !mapFile}
                  >
                    {uploading ? 'Uploading…' : 'Create battle map'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {battleMaps.length === 0 ? (
          <div className="py-12 text-center">
            <p className="type-subheading text-heading">
              Add your first battle map
            </p>
            <p className="type-body text-muted mt-2">
              Upload a map image to run encounters on and share with your
              players.
            </p>
            <Button className="mt-4" onClick={() => setDialogOpen(true)}>
              New battle map
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {battleMaps.map(bm => (
              <BattleMapListCard
                key={bm.id}
                battleMap={bm}
                campaignCode={code}
                onDelete={id => {
                  removeBattleMap(code, id);
                  fetch(`/api/campaign/${code}/battlemaps/${id}`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dmId }),
                  }).catch(() => {});
                }}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
