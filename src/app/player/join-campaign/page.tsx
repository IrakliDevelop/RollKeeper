'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Users,
  Key,
  Loader2,
  AlertCircle,
  CheckCircle,
  Crown,
  User,
} from 'lucide-react';
import { useCampaignStore } from '@/store/campaignStore';
import { usePlayerStore } from '@/store/playerStore';
import { useAuth } from '@/contexts/AuthContext';

export default function JoinCampaignPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { joinCampaign, isLoading, error, clearError } = useCampaignStore();
  const { characters } = usePlayerStore();

  const [formData, setFormData] = useState({
    inviteCode: '',
    characterId: '',
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [joinSuccess, setJoinSuccess] = useState(false);

  // Load characters on mount
  useEffect(() => {
    // Characters should already be loaded from the player store
    console.log('Available characters for campaign join:', characters);
  }, [characters]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear validation error when user starts typing
    if (validationErrors[name]) {
      setValidationErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.inviteCode.trim()) {
      errors.inviteCode = 'Invite code is required';
    } else if (formData.inviteCode.length !== 8) {
      errors.inviteCode = 'Invite code must be 8 characters';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    clearError();
    setJoinSuccess(false);
    
    const characterIdToSend = formData.characterId && formData.characterId.trim() !== '' ? formData.characterId : null;
    
    console.log('Form data before join:', { 
      inviteCode: formData.inviteCode.trim().toUpperCase(),
      characterId: formData.characterId,
      characterIdToSend,
      availableCharacters: characters.length 
    });
    
    const success = await joinCampaign({
      campaignId: 'temp', // This will be resolved by the invite code
      inviteCode: formData.inviteCode.trim().toUpperCase(),
      characterId: characterIdToSend || undefined,
    });

    if (success) {
      setJoinSuccess(true);
      setTimeout(() => {
        router.push('/player');
      }, 2000);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="flex min-h-96 items-center justify-center">
          <div className="text-center">
            <Users className="mx-auto mb-4 text-gray-400" size={48} />
            <h2 className="mb-4 text-xl font-semibold text-gray-900">Authentication Required</h2>
            <p className="mb-6 text-gray-600">Please sign in to join a campaign.</p>
            <Link
              href="/auth"
              className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (joinSuccess) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="flex min-h-96 items-center justify-center">
          <div className="text-center">
            <CheckCircle className="mx-auto mb-4 text-green-500" size={64} />
            <h2 className="mb-4 text-2xl font-semibold text-gray-900">Successfully Joined Campaign!</h2>
            <p className="mb-6 text-gray-600">
              You&apos;ve been added to the campaign. Redirecting to your campaigns...
            </p>
            <div className="flex items-center justify-center gap-2 text-gray-500">
              <Loader2 className="animate-spin" size={16} />
              <span>Redirecting...</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <Link
          href="/player"
          className="flex items-center gap-2 text-slate-600 transition-colors hover:text-slate-800"
        >
          <ArrowLeft size={20} />
          Back to Dashboard
        </Link>
        <div className="h-6 w-px bg-slate-300"></div>
        <h1 className="text-3xl font-bold text-slate-800">Join Campaign</h1>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 rounded-lg bg-red-50 border border-red-200 p-4">
          <div className="flex items-center gap-2">
            <AlertCircle className="text-red-600" size={20} />
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Form */}
      <div className="rounded-lg bg-white p-6 shadow-md">
        <div className="mb-6 text-center">
          <Users className="mx-auto mb-4 text-purple-600" size={48} />
          <h2 className="text-xl font-semibold text-slate-800">Join a D&D Campaign</h2>
          <p className="mt-2 text-gray-600">
            Enter the invite code provided by your Dungeon Master to join their campaign.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Invite Code */}
          <div>
            <label htmlFor="inviteCode" className="block text-sm font-medium text-gray-700 mb-2">
              <Key className="inline mr-2" size={16} />
              Campaign Invite Code *
            </label>
            <input
              type="text"
              id="inviteCode"
              name="inviteCode"
              value={formData.inviteCode}
              onChange={handleInputChange}
              className={`w-full rounded-lg border px-3 py-2 text-center text-lg font-mono tracking-wider focus:ring-1 focus:ring-purple-500 ${
                validationErrors.inviteCode 
                  ? 'border-red-300 focus:border-red-500' 
                  : 'border-gray-300 focus:border-purple-500'
              }`}
              placeholder="ABCD1234"
              maxLength={8}
              style={{ textTransform: 'uppercase' }}
            />
            {validationErrors.inviteCode && (
              <p className="mt-1 text-sm text-red-600">{validationErrors.inviteCode}</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              8-character code provided by your DM
            </p>
          </div>

          {/* Character Selection */}
          <div>
            <label htmlFor="characterId" className="block text-sm font-medium text-gray-700 mb-2">
              <User className="inline mr-2" size={16} />
              Select Character (Optional)
            </label>
            <select
              id="characterId"
              name="characterId"
              value={formData.characterId}
              onChange={handleInputChange}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:ring-1 focus:ring-purple-500 focus:border-purple-500"
            >
              <option value="">No character selected</option>
              {characters.map(character => (
                <option key={character.id} value={character.id}>
                  {character.name} - Level {character.level} {character.class}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              You can select a character to bring to this campaign, or join without one and create/assign a character later.
            </p>
          </div>

          {/* Info Box */}
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
            <div className="flex items-start gap-3">
              <Crown className="text-blue-600 mt-0.5" size={20} />
              <div>
                <h3 className="font-medium text-blue-900 mb-1">What happens when you join?</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• You&apos;ll be added to the campaign as a player</li>
                  <li>• Your selected character (if any) will be linked to the campaign</li>
                  <li>• The DM will be able to see your character&apos;s stats during combat</li>
                  <li>• Real-time updates will sync your character changes with the DM</li>
                  <li>• You can leave the campaign at any time from your campaigns page</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-6 py-3 text-white transition-colors hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                Joining Campaign...
              </>
            ) : (
              <>
                <Users size={16} />
                Join Campaign
              </>
            )}
          </button>
        </form>

        {/* Help Text */}
        <div className="mt-6 pt-6 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-600">
            Don&apos;t have an invite code?{' '}
            <span className="text-purple-600">Ask your Dungeon Master to share their campaign&apos;s invite code with you.</span>
          </p>
        </div>
      </div>
    </div>
  );
}
