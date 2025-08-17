'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';

export default function NewCampaignPage() {
  const router = useRouter();
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
      maxBackups: 10
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // TODO: Implement campaign creation with store
      console.log('Creating campaign:', formData);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Navigate to campaigns list or new campaign page
      router.push('/dm/campaigns');
    } catch (error) {
      console.error('Failed to create campaign:', error);
      // TODO: Show error toast
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string | boolean | number) => {
    if (field.startsWith('settings.')) {
      const settingField = field.replace('settings.', '');
      setFormData(prev => ({
        ...prev,
        settings: {
          ...prev.settings,
          [settingField]: value
        }
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [field]: value
      }));
    }
  };

  return (
    <div className="new-campaign-page">
      {/* Page Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link
          href="/dm/campaigns"
          className="flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors"
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
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Basic Information */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg p-6 shadow-md">
              <h2 className="text-xl font-semibold text-slate-800 mb-4">
                Basic Information
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-2">
                    Campaign Name *
                  </label>
                  <input
                    type="text"
                    id="name"
                    required
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="The Lost Mine of Phandelver"
                  />
                </div>
                
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-slate-700 mb-2">
                    Description
                  </label>
                  <textarea
                    id="description"
                    rows={4}
                    value={formData.description}
                    onChange={(e) => handleInputChange('description', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="A brief description of your campaign..."
                  />
                </div>
              </div>
            </div>

            {/* Rule Settings */}
            <div className="bg-white rounded-lg p-6 shadow-md">
              <h2 className="text-xl font-semibold text-slate-800 mb-4">
                Rule Settings
              </h2>
              
              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="useVariantRules"
                    checked={formData.settings.useVariantRules}
                    onChange={(e) => handleInputChange('settings.useVariantRules', e.target.checked)}
                    className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-slate-300 rounded"
                  />
                  <label htmlFor="useVariantRules" className="ml-2 text-sm text-slate-700">
                    Use variant rules (flanking, etc.)
                  </label>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="allowMulticlassing"
                    checked={formData.settings.allowMulticlassing}
                    onChange={(e) => handleInputChange('settings.allowMulticlassing', e.target.checked)}
                    className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-slate-300 rounded"
                  />
                  <label htmlFor="allowMulticlassing" className="ml-2 text-sm text-slate-700">
                    Allow multiclassing
                  </label>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="useOptionalFeats"
                    checked={formData.settings.useOptionalFeats}
                    onChange={(e) => handleInputChange('settings.useOptionalFeats', e.target.checked)}
                    className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-slate-300 rounded"
                  />
                  <label htmlFor="useOptionalFeats" className="ml-2 text-sm text-slate-700">
                    Use optional feats
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Combat Settings */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg p-6 shadow-md">
              <h2 className="text-xl font-semibold text-slate-800 mb-4">
                Combat Settings
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label htmlFor="initiativeType" className="block text-sm font-medium text-slate-700 mb-2">
                    Initiative Type
                  </label>
                  <select
                    id="initiativeType"
                    value={formData.settings.initiativeType}
                    onChange={(e) => handleInputChange('settings.initiativeType', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
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
                    onChange={(e) => handleInputChange('settings.trackResources', e.target.checked)}
                    className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-slate-300 rounded"
                  />
                  <label htmlFor="trackResources" className="ml-2 text-sm text-slate-700">
                    Track spell slots and abilities
                  </label>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="showPlayerHP"
                    checked={formData.settings.showPlayerHP}
                    onChange={(e) => handleInputChange('settings.showPlayerHP', e.target.checked)}
                    className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-slate-300 rounded"
                  />
                  <label htmlFor="showPlayerHP" className="ml-2 text-sm text-slate-700">
                    Show player HP to other players
                  </label>
                </div>
              </div>
            </div>

            {/* Canvas Settings */}
            <div className="bg-white rounded-lg p-6 shadow-md">
              <h2 className="text-xl font-semibold text-slate-800 mb-4">
                Canvas Settings
              </h2>
              
              <div className="space-y-4">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="showGridOnCanvas"
                    checked={formData.settings.showGridOnCanvas}
                    onChange={(e) => handleInputChange('settings.showGridOnCanvas', e.target.checked)}
                    className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-slate-300 rounded"
                  />
                  <label htmlFor="showGridOnCanvas" className="ml-2 text-sm text-slate-700">
                    Show grid on combat canvas
                  </label>
                </div>
                
                <div>
                  <label htmlFor="defaultGridSize" className="block text-sm font-medium text-slate-700 mb-2">
                    Default Grid Size (feet)
                  </label>
                  <input
                    type="number"
                    id="defaultGridSize"
                    min="1"
                    max="10"
                    value={formData.settings.defaultGridSize}
                    onChange={(e) => handleInputChange('settings.defaultGridSize', parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-4 mt-8 pt-6 border-t border-slate-200">
          <Link
            href="/dm/campaigns"
            className="px-6 py-2 text-slate-600 hover:text-slate-800 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isLoading || !formData.name.trim()}
            className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Save size={16} />
            {isLoading ? 'Creating...' : 'Create Campaign'}
          </button>
        </div>
      </form>
    </div>
  );
}
