'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Plus,
  Save,
  Loader2,
  AlertCircle,
  Users,
  Settings,
  Crown,
} from 'lucide-react';
import { useCampaignStore } from '@/store/campaignStore';
import { useAuth } from '@/contexts/AuthContext';

export default function NewCampaignPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { createCampaign, isLoading, error, clearError } = useCampaignStore();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    settings: {
      allowPlayerInvites: false,
      autoApproveJoins: true,
      maxPlayers: 6,
      enableRealTimeUpdates: true,
      enableCombatTracker: true,
      publicCampaign: false,
    },
  });

  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear validation error when user starts typing
    if (validationErrors[name]) {
      setValidationErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSettingChange = (setting: string, value: boolean | number) => {
    setFormData(prev => ({
      ...prev,
      settings: { ...prev.settings, [setting]: value },
    }));
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Campaign name is required';
    } else if (formData.name.length > 200) {
      errors.name = 'Campaign name must be 200 characters or less';
    }

    if (formData.description.length > 1000) {
      errors.description = 'Description must be 1000 characters or less';
    }

    if (formData.settings.maxPlayers < 1 || formData.settings.maxPlayers > 20) {
      errors.maxPlayers = 'Max players must be between 1 and 20';
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
    
    const campaign = await createCampaign(
      formData.name.trim(),
      formData.description.trim() || undefined,
      formData.settings
    );

    if (campaign) {
      router.push(`/dm/campaigns/${campaign.id}`);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-96 items-center justify-center">
        <div className="text-center">
          <Crown className="mx-auto mb-4 text-gray-400" size={48} />
          <h2 className="mb-4 text-xl font-semibold text-gray-900">Authentication Required</h2>
          <p className="mb-6 text-gray-600">Please sign in to create a campaign.</p>
          <Link
            href="/auth"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <Link
          href="/dm/campaigns"
          className="flex items-center gap-2 text-slate-600 transition-colors hover:text-slate-800"
        >
          <ArrowLeft size={20} />
          Back to Campaigns
        </Link>
        <div className="h-6 w-px bg-slate-300"></div>
        <h1 className="text-3xl font-bold text-slate-800">Create New Campaign</h1>
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
      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Information */}
        <div className="rounded-lg bg-white p-6 shadow-md">
          <h2 className="mb-6 text-xl font-semibold text-slate-800">Basic Information</h2>
          
          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Campaign Name *
              </label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                className={`w-full rounded-lg border px-3 py-2 focus:ring-1 focus:ring-purple-500 ${
                  validationErrors.name 
                    ? 'border-red-300 focus:border-red-500' 
                    : 'border-gray-300 focus:border-purple-500'
                }`}
                placeholder="Enter campaign name"
                maxLength={200}
              />
              {validationErrors.name && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.name}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                {formData.name.length}/200 characters
              </p>
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={4}
                className={`w-full rounded-lg border px-3 py-2 focus:ring-1 focus:ring-purple-500 ${
                  validationErrors.description 
                    ? 'border-red-300 focus:border-red-500' 
                    : 'border-gray-300 focus:border-purple-500'
                }`}
                placeholder="Describe your campaign (optional)"
                maxLength={1000}
              />
              {validationErrors.description && (
                <p className="mt-1 text-sm text-red-600">{validationErrors.description}</p>
              )}
              <p className="mt-1 text-xs text-gray-500">
                {formData.description.length}/1000 characters
              </p>
            </div>
          </div>
        </div>

        {/* Campaign Settings */}
        <div className="rounded-lg bg-white p-6 shadow-md">
          <h2 className="mb-6 flex items-center gap-2 text-xl font-semibold text-slate-800">
            <Settings size={20} />
            Campaign Settings
          </h2>
          
          <div className="space-y-6">
            {/* Player Management */}
            <div>
              <h3 className="mb-4 text-lg font-medium text-slate-700">Player Management</h3>
              <div className="space-y-4">
                <div>
                  <label htmlFor="maxPlayers" className="block text-sm font-medium text-gray-700 mb-2">
                    Maximum Players
                  </label>
                  <input
                    type="number"
                    id="maxPlayers"
                    min="1"
                    max="20"
                    value={formData.settings.maxPlayers}
                    onChange={(e) => handleSettingChange('maxPlayers', parseInt(e.target.value) || 1)}
                    className={`w-24 rounded-lg border px-3 py-2 focus:ring-1 focus:ring-purple-500 ${
                      validationErrors.maxPlayers 
                        ? 'border-red-300 focus:border-red-500' 
                        : 'border-gray-300 focus:border-purple-500'
                    }`}
                  />
                  {validationErrors.maxPlayers && (
                    <p className="mt-1 text-sm text-red-600">{validationErrors.maxPlayers}</p>
                  )}
                </div>

                <div className="space-y-3">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.settings.autoApproveJoins}
                      onChange={(e) => handleSettingChange('autoApproveJoins', e.target.checked)}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700">
                      Auto-approve player joins (players can join immediately with invite code)
                    </span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.settings.allowPlayerInvites}
                      onChange={(e) => handleSettingChange('allowPlayerInvites', e.target.checked)}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700">
                      Allow players to invite other players
                    </span>
                  </label>

                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formData.settings.publicCampaign}
                      onChange={(e) => handleSettingChange('publicCampaign', e.target.checked)}
                      className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-700">
                      Public campaign (visible in campaign browser)
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Real-time Features */}
            <div>
              <h3 className="mb-4 text-lg font-medium text-slate-700">Real-time Features</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.settings.enableRealTimeUpdates}
                    onChange={(e) => handleSettingChange('enableRealTimeUpdates', e.target.checked)}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-700">
                    Enable real-time character updates (HP, spell slots, conditions)
                  </span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={formData.settings.enableCombatTracker}
                    onChange={(e) => handleSettingChange('enableCombatTracker', e.target.checked)}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm text-gray-700">
                    Enable enhanced combat tracker with real-time updates
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-between">
          <Link
            href="/dm/campaigns"
            className="rounded-lg border border-gray-300 px-6 py-2 text-gray-700 transition-colors hover:bg-gray-50"
          >
            Cancel
          </Link>
          
          <button
            type="submit"
            disabled={isLoading}
            className="flex items-center gap-2 rounded-lg bg-purple-600 px-6 py-2 text-white transition-colors hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <Loader2 className="animate-spin" size={16} />
                Creating Campaign...
              </>
            ) : (
              <>
                <Plus size={16} />
                Create Campaign
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}