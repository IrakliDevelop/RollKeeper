'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { io, Socket } from 'socket.io-client';
import { useAuthContext } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import {
  useCampaignStore,
  CharacterSummary,
  CampaignMember,
} from '@/store/campaignStore';
import { Button } from '@/components/ui/forms/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/layout/card';
import { Badge } from '@/components/ui/layout/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/feedback/dialog-new';
import {
  ArrowLeft,
  Copy,
  Users,
  Heart,
  Shield,
  RefreshCw,
  Trash2,
  Settings,
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function CharacterCard({
  character,
  onClick,
}: {
  character: CharacterSummary;
  onClick: () => void;
}) {
  const hpPercentage =
    character.hp_max > 0
      ? Math.round((character.hp_current / character.hp_max) * 100)
      : 0;

  const hpColor =
    hpPercentage > 50
      ? 'bg-green-500'
      : hpPercentage > 25
        ? 'bg-yellow-500'
        : 'bg-red-500';

  return (
    <Card
      className="cursor-pointer border-slate-700 bg-slate-800/60 transition-all hover:border-slate-500 hover:bg-slate-800"
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-white">{character.name}</h3>
            <p className="text-sm text-slate-400">
              {character.race} {character.class}
            </p>
          </div>
          <Badge variant="outline">Lv {character.level}</Badge>
        </div>

        {/* HP Bar */}
        <div className="mb-3">
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1 text-slate-400">
              <Heart size={12} className="text-red-400" />
              HP
            </span>
            <span className="text-white">
              {character.hp_current} / {character.hp_max}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-700">
            <div
              className={`h-full rounded-full transition-all ${hpColor}`}
              style={{ width: `${Math.min(hpPercentage, 100)}%` }}
            />
          </div>
        </div>

        {/* Stats Row */}
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <Shield size={12} className="text-blue-400" />
            AC {character.ac}
          </span>
          {character.player_name && (
            <span className="text-slate-500">
              Player: {character.player_name}
            </span>
          )}
        </div>

        {/* Sync time */}
        <p className="mt-2 text-xs text-slate-600">
          Synced{' '}
          {new Date(character.last_synced_at).toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </CardContent>
    </Card>
  );
}

function MemberList({ members }: { members: CampaignMember[] }) {
  if (members.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No players have joined yet. Share the invite code!
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {members.map(member => (
        <div
          key={member.id}
          className="flex items-center justify-between rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-2"
        >
          <div>
            <span className="text-sm text-white">
              {member.display_name ||
                member.username ||
                member.email ||
                'Unknown'}
            </span>
            <span className="ml-2 text-xs text-slate-500">({member.role})</span>
          </div>
          <Badge variant={member.status === 'active' ? 'success' : 'secondary'}>
            {member.status}
          </Badge>
        </div>
      ))}
    </div>
  );
}

function CharacterDetailDialog({
  campaignId,
  characterId,
  characterName,
  open,
  onOpenChange,
}: {
  campaignId: string;
  characterId: string;
  characterName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [snapshot, setSnapshot] = useState<Record<string, unknown> | null>(
    null
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && campaignId && characterId) {
      setLoading(true);
      import('@/lib/api').then(({ characterApi }) => {
        characterApi
          .getSnapshot(campaignId, characterId)
          .then(result => {
            if (result.success) {
              const data = result.data as {
                character: { character_snapshot: Record<string, unknown> };
              };
              setSnapshot(data.character.character_snapshot);
            }
            setLoading(false);
          })
          .catch(() => setLoading(false));
      });
    }
  }, [open, campaignId, characterId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{characterName} — Full Sheet</DialogTitle>
        </DialogHeader>
        <DialogBody>
          {loading && (
            <p className="text-slate-400">Loading character data...</p>
          )}
          {snapshot && <SnapshotDisplay snapshot={snapshot} />}
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function str(val: unknown): string {
  if (val == null) return '';
  return String(val);
}

function SnapshotDisplay({ snapshot }: { snapshot: Record<string, unknown> }) {
  const classObj = snapshot.class as Record<string, unknown> | undefined;
  const className = str(classObj?.name ?? snapshot.class ?? 'Unknown');
  const level = str(
    (snapshot.totalLevel as number) || (snapshot.level as number) || 1
  );
  const hp = snapshot.hitPoints as Record<string, number> | undefined;
  const abilities = snapshot.abilities as Record<string, number> | undefined;
  const weapons = snapshot.weapons as
    | Array<Record<string, unknown>>
    | undefined;

  return (
    <div className="space-y-4 text-sm text-slate-300">
      <div className="grid grid-cols-2 gap-3">
        <InfoRow label="Name" value={str(snapshot.name)} />
        <InfoRow label="Race" value={str(snapshot.race)} />
        <InfoRow label="Class" value={className} />
        <InfoRow label="Level" value={level} />
        <InfoRow label="Background" value={str(snapshot.background)} />
        <InfoRow label="Alignment" value={str(snapshot.alignment)} />
      </div>

      {abilities && (
        <div>
          <h4 className="mb-2 font-semibold text-white">Ability Scores</h4>
          <div className="grid grid-cols-6 gap-2">
            {Object.entries(abilities).map(([ability, score]) => (
              <div
                key={ability}
                className="rounded-lg border border-slate-700 bg-slate-800/60 p-2 text-center"
              >
                <div className="text-xs text-slate-500 uppercase">
                  {ability.slice(0, 3)}
                </div>
                <div className="text-lg font-bold text-white">{score}</div>
                <div className="text-xs text-slate-400">
                  {score >= 10 ? '+' : ''}
                  {Math.floor((score - 10) / 2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h4 className="mb-2 font-semibold text-white">Combat</h4>
        <div className="grid grid-cols-3 gap-3">
          <InfoRow
            label="HP"
            value={`${hp?.current ?? '?'} / ${hp?.max ?? '?'}`}
          />
          <InfoRow label="AC" value={str(snapshot.armorClass ?? '?')} />
          <InfoRow label="Speed" value={`${str(snapshot.speed ?? '?')} ft`} />
        </div>
      </div>

      {weapons && weapons.length > 0 && (
        <div>
          <h4 className="mb-2 font-semibold text-white">Weapons</h4>
          <ul className="list-inside list-disc text-slate-400">
            {weapons.map((w, i) => (
              <li key={i}>{str(w.name) || 'Unknown weapon'}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <span className="text-xs text-slate-500">{label}</span>
      <p className="text-white">{value || '—'}</p>
    </div>
  );
}

function CampaignDetailContent() {
  const router = useRouter();
  const params = useParams();
  const campaignId = params.id as string;
  const { isAuthenticated } = useAuthContext();
  const {
    activeCampaign,
    activeMembers,
    activeCharacters,
    isDm,
    loading,
    error,
    fetchCampaignDetail,
    deleteCampaign,
    updateCharacterSummary,
    clearActive,
  } = useCampaignStore();

  const [copied, setCopied] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Fetch campaign data
  useEffect(() => {
    if (campaignId) {
      fetchCampaignDetail(campaignId);
    }
    return () => clearActive();
  }, [campaignId, fetchCampaignDetail, clearActive]);

  // Socket.io for real-time updates
  const handleCharacterSynced = useCallback(
    (data: { campaignId: string; characterSummary: CharacterSummary }) => {
      if (data.campaignId === campaignId) {
        updateCharacterSummary(data.characterSummary);
      }
    },
    [campaignId, updateCharacterSummary]
  );

  useEffect(() => {
    if (!isAuthenticated || !campaignId) return;

    const socket: Socket = io(API_URL, { transports: ['websocket'] });

    socket.on('connect', () => {
      setSocketConnected(true);
      socket.emit('join_campaign', { campaignId });
    });

    socket.on('disconnect', () => setSocketConnected(false));
    socket.on('campaign_character_synced', handleCharacterSynced);

    return () => {
      socket.emit('leave_campaign', { campaignId });
      socket.disconnect();
    };
  }, [isAuthenticated, campaignId, handleCharacterSynced]);

  const handleCopyCode = async () => {
    if (activeCampaign) {
      await navigator.clipboard.writeText(activeCampaign.invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDelete = async () => {
    if (
      activeCampaign &&
      confirm(
        'Are you sure you want to delete this campaign? This cannot be undone.'
      )
    ) {
      const deleted = await deleteCampaign(activeCampaign.id);
      if (deleted) {
        router.push('/dm');
      }
    }
  };

  if (loading && !activeCampaign) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900">
        <p className="text-slate-400">Loading campaign...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-900">
        <p className="text-red-400">{error}</p>
        <Link href="/dm">
          <Button variant="ghost">Back to Dashboard</Button>
        </Link>
      </div>
    );
  }

  if (!activeCampaign) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Link href="/dm">
              <Button variant="ghost" size="sm">
                <ArrowLeft size={16} className="mr-1" />
                Back
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold text-white">
                {activeCampaign.name}
              </h1>
              {activeCampaign.description && (
                <p className="text-sm text-slate-400">
                  {activeCampaign.description}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Connection indicator */}
            <div className="flex items-center gap-1.5">
              <div
                className={`h-2 w-2 rounded-full ${socketConnected ? 'bg-green-400' : 'bg-red-400'}`}
              />
              <span className="text-xs text-slate-500">
                {socketConnected ? 'Live' : 'Offline'}
              </span>
            </div>
            {isDm && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                className="text-red-400 hover:text-red-300"
              >
                <Trash2 size={14} />
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Left: Party Characters */}
          <div className="lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">
                Party ({activeCharacters.length})
              </h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => fetchCampaignDetail(campaignId)}
              >
                <RefreshCw size={14} className="mr-1" />
                Refresh
              </Button>
            </div>

            {activeCharacters.length === 0 ? (
              <Card className="border-slate-700 bg-slate-800/40">
                <CardContent className="py-12 text-center">
                  <Users size={36} className="mx-auto mb-3 text-slate-600" />
                  <p className="text-slate-400">
                    No characters synced yet. Players need to join and sync
                    their characters.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {activeCharacters.map(character => (
                  <CharacterCard
                    key={character.character_id}
                    character={character}
                    onClick={() =>
                      setSelectedCharacter({
                        id: character.character_id,
                        name: character.name,
                      })
                    }
                  />
                ))}
              </div>
            )}
          </div>

          {/* Right Sidebar: Campaign Info */}
          <div className="space-y-6">
            {/* Invite Code */}
            <Card className="border-slate-700 bg-slate-800/60">
              <CardHeader>
                <CardTitle className="text-sm text-slate-300">
                  Invite Code
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded-lg bg-slate-900 px-4 py-2 text-center text-lg font-bold tracking-widest text-amber-400">
                    {activeCampaign.invite_code}
                  </code>
                  <Button variant="ghost" size="sm" onClick={handleCopyCode}>
                    <Copy size={14} />
                  </Button>
                </div>
                {copied && (
                  <p className="mt-1 text-center text-xs text-green-400">
                    Copied to clipboard!
                  </p>
                )}
                <p className="mt-2 text-center text-xs text-slate-500">
                  Share this code with your players
                </p>
              </CardContent>
            </Card>

            {/* Campaign Settings */}
            <Card className="border-slate-700 bg-slate-800/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm text-slate-300">
                  <Settings size={14} />
                  Campaign Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">Status</span>
                  <Badge
                    variant={
                      activeCampaign.status === 'active'
                        ? 'success'
                        : 'secondary'
                    }
                  >
                    {activeCampaign.status}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Campaign Day</span>
                  <span className="text-white">
                    {activeCampaign.current_day}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Rule Set</span>
                  <span className="text-white">
                    {activeCampaign.settings.ruleSet}
                  </span>
                </div>
              </CardContent>
            </Card>

            {/* Members */}
            <Card className="border-slate-700 bg-slate-800/60">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm text-slate-300">
                  <Users size={14} />
                  Members ({activeMembers.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <MemberList members={activeMembers} />
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Character Detail Dialog */}
      {selectedCharacter && (
        <CharacterDetailDialog
          campaignId={campaignId}
          characterId={selectedCharacter.id}
          characterName={selectedCharacter.name}
          open={!!selectedCharacter}
          onOpenChange={open => {
            if (!open) setSelectedCharacter(null);
          }}
        />
      )}
    </div>
  );
}

export default function CampaignDetailPage() {
  return (
    <ProtectedRoute>
      <CampaignDetailContent />
    </ProtectedRoute>
  );
}
