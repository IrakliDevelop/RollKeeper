'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthContext } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { useCampaignStore, Campaign } from '@/store/campaignStore';
import { Button } from '@/components/ui/forms/button';
import { Input } from '@/components/ui/forms/input';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/layout/card';
import { Badge } from '@/components/ui/layout/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/feedback/dialog-new';
import { Plus, LogOut, Users, Swords, Copy } from 'lucide-react';

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = async () => {
    await navigator.clipboard.writeText(campaign.invite_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Link href={`/dm/campaigns/${campaign.id}`}>
      <Card className="cursor-pointer border-slate-700 bg-slate-800/60 transition-all hover:border-slate-500 hover:bg-slate-800">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-lg text-white">
                {campaign.name}
              </CardTitle>
              {campaign.description && (
                <CardDescription className="mt-1 text-slate-400">
                  {campaign.description}
                </CardDescription>
              )}
            </div>
            <Badge
              variant={
                campaign.status === 'active'
                  ? 'success'
                  : campaign.status === 'paused'
                    ? 'secondary'
                    : 'outline'
              }
            >
              {campaign.status}
            </Badge>
          </div>
        </CardHeader>
        <CardFooter className="flex items-center justify-between text-sm text-slate-400">
          <span>Day {campaign.current_day}</span>
          <button
            onClick={e => {
              e.preventDefault();
              e.stopPropagation();
              handleCopyCode();
            }}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
            title="Copy invite code"
          >
            <Copy size={12} />
            {copied ? 'Copied!' : campaign.invite_code}
          </button>
        </CardFooter>
      </Card>
    </Link>
  );
}

function CreateCampaignDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const createCampaign = useCampaignStore(s => s.createCampaign);
  const loading = useCampaignStore(s => s.loading);

  const handleCreate = async () => {
    if (!name.trim()) return;
    const campaign = await createCampaign(
      name.trim(),
      description.trim() || undefined
    );
    if (campaign) {
      setName('');
      setDescription('');
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="primary">
          <Plus size={16} className="mr-2" />
          New Campaign
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Campaign</DialogTitle>
          <DialogDescription>
            Create a new campaign and invite your players with a code.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <Input
            label="Campaign Name"
            placeholder="e.g. Curse of Strahd"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />
          <Input
            label="Description (optional)"
            placeholder="A brief description of the campaign"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </DialogBody>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreate}
            disabled={loading || !name.trim()}
          >
            {loading ? 'Creating...' : 'Create Campaign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function JoinCampaignDialog() {
  const [open, setOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const joinCampaign = useCampaignStore(s => s.joinCampaign);
  const loading = useCampaignStore(s => s.loading);

  const handleJoin = async () => {
    if (!inviteCode.trim()) return;
    setError(null);
    const result = await joinCampaign(inviteCode.trim());
    if (result.error) {
      setError(result.error);
    } else {
      setInviteCode('');
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Users size={16} className="mr-2" />
          Join Campaign
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Join a Campaign</DialogTitle>
          <DialogDescription>
            Enter the invite code from your DM to join their campaign.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {error && (
            <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-400">
              {error}
            </div>
          )}
          <Input
            label="Invite Code"
            placeholder="e.g. DRAGON42"
            value={inviteCode}
            onChange={e => setInviteCode(e.target.value.toUpperCase())}
            required
          />
        </DialogBody>
        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleJoin}
            disabled={loading || !inviteCode.trim()}
          >
            {loading ? 'Joining...' : 'Join Campaign'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DmDashboardContent() {
  const router = useRouter();
  const { signOut, user } = useAuthContext();
  const { campaigns, loading, error, fetchCampaigns, clearError } =
    useCampaignStore();

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const dmCampaigns = campaigns.filter(c => c.dm_id !== undefined);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700 bg-slate-900/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <Swords size={24} className="text-amber-400" />
            <h1 className="text-xl font-bold text-white">RollKeeper DM</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400">{user?.email}</span>
            <Link href="/">
              <Button variant="ghost" size="sm">
                Character Sheets
              </Button>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                signOut();
                router.push('/');
              }}
            >
              <LogOut size={14} className="mr-1" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-6xl px-6 py-8">
        {/* Actions */}
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-white">My Campaigns</h2>
          <div className="flex gap-3">
            <JoinCampaignDialog />
            <CreateCampaignDialog />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 rounded-lg border border-red-500/50 bg-red-500/10 p-4 text-red-400">
            <div className="flex items-center justify-between">
              <span>{error}</span>
              <button
                onClick={clearError}
                className="text-red-300 hover:text-white"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && campaigns.length === 0 && (
          <div className="py-20 text-center text-slate-400">
            Loading campaigns...
          </div>
        )}

        {/* Empty state */}
        {!loading && campaigns.length === 0 && (
          <Card className="border-slate-700 bg-slate-800/40">
            <CardContent className="py-16 text-center">
              <Swords size={48} className="mx-auto mb-4 text-slate-600" />
              <h3 className="mb-2 text-lg font-medium text-white">
                No campaigns yet
              </h3>
              <p className="mb-6 text-slate-400">
                Create a new campaign as DM, or join one using an invite code.
              </p>
              <div className="flex justify-center gap-3">
                <JoinCampaignDialog />
                <CreateCampaignDialog />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Campaign Grid */}
        {dmCampaigns.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {dmCampaigns.map(campaign => (
              <CampaignCard key={campaign.id} campaign={campaign} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default function DmDashboardPage() {
  return (
    <ProtectedRoute>
      <DmDashboardContent />
    </ProtectedRoute>
  );
}
