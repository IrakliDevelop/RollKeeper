'use client';

import React, { useState, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Map, Plus } from 'lucide-react';
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
import { BattleMapListCard } from '@/components/ui/campaign/battle-map/BattleMapListCard';
import { useBattleMapStore, generateBattleMapId } from '@/store/battleMapStore';
import { useHydration } from '@/hooks/useHydration';
import { useDmStore } from '@/store/dmStore';

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
      const formData = new FormData();
      formData.append('file', mapFile);
      formData.append('assetId', assetId);

      const res = await fetch('/api/assets/upload', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');

      const { url } = (await res.json()) as { url: string };

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
                <Map className="text-accent-orange-text mr-3 h-6 w-6" />
                <h1 className="text-heading text-xl font-bold">Battle Maps</h1>
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
                    New Battle Map
                  </Button>
                </DialogTrigger>
                <DialogContent size="sm">
                  <DialogHeader>
                    <DialogTitle>New Battle Map</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit}>
                    <DialogBody className="flex flex-col gap-4 px-6 pt-4">
                      <div>
                        <label className="text-body mb-1.5 block text-sm font-medium">
                          Battle Map Name
                        </label>
                        <Input
                          value={mapName}
                          onChange={e => setMapName(e.target.value)}
                          placeholder="e.g. Goblin Ambush, Dragon Lair"
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
                            mapFile ? 'border-accent-orange-border' : ''
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
                              <Map
                                size={24}
                                className="text-accent-orange-text"
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
                        disabled={uploading || !mapName.trim() || !mapFile}
                      >
                        {uploading ? 'Uploading...' : 'Create Battle Map'}
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
        {battleMaps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Map className="text-muted mb-4 h-12 w-12" />
            <p className="text-heading mb-1 text-lg font-semibold">
              No battle maps yet
            </p>
            <p className="text-muted text-sm">Upload a map to get started.</p>
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
