'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import { useDMStore } from '@/store/dmStore';

export default function NewCampaignPage() {
  const router = useRouter();
  const { createCampaign } = useDMStore();
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    tags: [] as string[],
    settings: {
      useVariantRules: false,
      allowMulticlassing: true,
      useOptionalFeats: true,
      initiativeType: 'individual' as const,
      autoAdvanceTurns: false,
      trackResources: true,
      showPlayerHP: true,
      showGridOnCanvas: true,
      defaultGridSize: 5,
      canvasTheme: 'light' as const,
      autoBackup: true,
      backupInterval: 5,
      maxBackups: 10,
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (!formData.name.trim()) {
        alert('Please enter a campaign name');
        setIsLoading(false);
        return;
      }

      const campaignId = createCampaign({
        name: formData.name.trim(),
        description: formData.description.trim(),
        dmId: 'default-dm', // TODO: Get from user context
        tags: formData.tags.filter(tag => tag.trim()),
        settings: formData.settings,
        playerCharacters: [],
        sessions: [],
        encounters: [],
        notes: [],
        isArchived: false,
      });

      // Navigate to the new campaign page
      router.push(`/dm/campaigns/${campaignId}`);
    } catch (error) {
      console.error('Failed to create campaign:', error);
      alert('Failed to create campaign. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (
    field: string,
    value: string | boolean | number
  ) => {
    if (field.startsWith('settings.')) {
      const settingField = field.replace('settings.', '');
      setFormData(prev => ({
        ...prev,
        settings: {
          ...prev.settings,
          [settingField]: value,
        },
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value,
      }));
    }
  };

  return (
    <div className="new-campaign-page">
      {/* Page Header */}
      <div className="mb-8 flex items-center gap-4">
        <Link
          href="/dm/campaigns"
          className="flex items-center gap-2 text-slate-600 transition-colors hover:text-slate-800"
        >
          <ArrowLeft size={20} />
          Back to Campaigns
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-slate-800">
            Create New Campaign
          </h1>
          <p className="text-slate-600">
            Set up a new D&D campaign with your preferred settings.
          </p>
        </div>
      </div>

      {/* Campaign Form */}
      <form onSubmit={handleSubmit} className="max-w-4xl">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Basic Information */}
          <div className="space-y-6 lg:col-span-2">
            <div className="rounded-lg bg-white p-6 shadow-md">
              <h2 className="mb-4 text-xl font-semibold text-slate-800">
                Basic Information
              </h2>

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="name"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Campaign Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    required
                    value={formData.name}
                    onChange={e => handleInputChange('name', e.target.value)}
                    className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    placeholder="The Lost Mine of Phandelver"
                  />
                </div>

                <div>
                  <label
                    htmlFor="description"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Description
                  </label>
                  <textarea
                    id="description"
                    rows={4}
                    value={formData.description}
                    onChange={e =>
                      handleInputChange('description', e.target.value)
                    }
                    className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-purple-500 focus:outline-none"
                    placeholder="A brief description of your campaign..."
                  />
                </div>
              </div>
            </div>

            {/* Rule Settings */}
            <div className="rounded-lg bg-white p-6 shadow-md">
              <h2 className="mb-4 text-xl font-semibold text-slate-800">
                Rule Settings
              </h2>

              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="useVariantRules"
                    checked={formData.settings.useVariantRules}
                    onChange={e =>
                      handleInputChange(
                        'settings.useVariantRules',
                        e.target.checked
                      )
                    }
                    className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                  />
                  <label
                    htmlFor="useVariantRules"
                    className="ml-2 text-sm text-slate-700"
                  >
                    Use variant rules (flanking, etc.)
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="allowMulticlassing"
                    checked={formData.settings.allowMulticlassing}
                    onChange={e =>
                      handleInputChange(
                        'settings.allowMulticlassing',
                        e.target.checked
                      )
                    }
                    className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                  />
                  <label
                    htmlFor="allowMulticlassing"
                    className="ml-2 text-sm text-slate-700"
                  >
                    Allow multiclassing
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="useOptionalFeats"
                    checked={formData.settings.useOptionalFeats}
                    onChange={e =>
                      handleInputChange(
                        'settings.useOptionalFeats',
                        e.target.checked
                      )
                    }
                    className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                  />
                  <label
                    htmlFor="useOptionalFeats"
                    className="ml-2 text-sm text-slate-700"
                  >
                    Use optional feats
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Combat Settings */}
          <div className="space-y-6">
            <div className="rounded-lg bg-white p-6 shadow-md">
              <h2 className="mb-4 text-xl font-semibold text-slate-800">
                Combat Settings
              </h2>

              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="initiativeType"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Initiative Type
                  </label>
                  <select
                    id="initiativeType"
                    value={formData.settings.initiativeType}
                    onChange={e =>
                      handleInputChange(
                        'settings.initiativeType',
                        e.target.value
                      )
                    }
                    className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  >
                    <option value="individual">Individual</option>
                    <option value="group">Group</option>
                    <option value="side">Side-based</option>
                  </select>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="trackResources"
                    checked={formData.settings.trackResources}
                    onChange={e =>
                      handleInputChange(
                        'settings.trackResources',
                        e.target.checked
                      )
                    }
                    className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                  />
                  <label
                    htmlFor="trackResources"
                    className="ml-2 text-sm text-slate-700"
                  >
                    Track spell slots and abilities
                  </label>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="showPlayerHP"
                    checked={formData.settings.showPlayerHP}
                    onChange={e =>
                      handleInputChange(
                        'settings.showPlayerHP',
                        e.target.checked
                      )
                    }
                    className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                  />
                  <label
                    htmlFor="showPlayerHP"
                    className="ml-2 text-sm text-slate-700"
                  >
                    Show player HP to other players
                  </label>
                </div>
              </div>
            </div>

            {/* Canvas Settings */}
            <div className="rounded-lg bg-white p-6 shadow-md">
              <h2 className="mb-4 text-xl font-semibold text-slate-800">
                Canvas Settings
              </h2>

              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="showGridOnCanvas"
                    checked={formData.settings.showGridOnCanvas}
                    onChange={e =>
                      handleInputChange(
                        'settings.showGridOnCanvas',
                        e.target.checked
                      )
                    }
                    className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                  />
                  <label
                    htmlFor="showGridOnCanvas"
                    className="ml-2 text-sm text-slate-700"
                  >
                    Show grid on combat canvas
                  </label>
                </div>

                <div>
                  <label
                    htmlFor="defaultGridSize"
                    className="mb-2 block text-sm font-medium text-slate-700"
                  >
                    Default Grid Size (feet)
                  </label>
                  <input
                    type="number"
                    id="defaultGridSize"
                    min="1"
                    max="10"
                    value={formData.settings.defaultGridSize}
                    onChange={e =>
                      handleInputChange(
                        'settings.defaultGridSize',
                        parseInt(e.target.value)
                      )
                    }
                    className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-purple-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="mt-8 flex items-center justify-end gap-4 border-t border-slate-200 pt-6">
          <Link
            href="/dm/campaigns"
            className="px-6 py-2 text-slate-600 transition-colors hover:text-slate-800"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isLoading || !formData.name.trim()}
            className="flex items-center gap-2 rounded-lg bg-purple-600 px-6 py-2 text-white transition-colors hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Save size={16} />
            {isLoading ? 'Creating...' : 'Create Campaign'}
          </button>
        </div>
      </form>
    </div>
  );
}
