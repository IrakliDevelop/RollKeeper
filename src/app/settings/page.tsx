'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  User, 
  Shield, 
  Bell, 
  Palette, 
  Database,
  Download,
  Upload,
  Trash2,
  Save,
  Crown
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { HeaderAuthButton } from '@/components/ui/auth/AuthButton';
import { SyncIndicator } from '@/components/ui/sync/SyncIndicator';
import { MigrationPanel } from '@/components/ui/migration/MigrationPanel';
import { CharacterIdMigrationPanel } from '@/components/ui/migration/CharacterIdMigrationPanel';

export default function SettingsPage() {
  const { user, isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');

  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
        <div className="text-center">
          <h1 className="mb-4 text-2xl font-bold text-gray-900">Sign In Required</h1>
          <p className="mb-6 text-gray-600">You need to be signed in to access settings.</p>
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

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'preferences', label: 'Preferences', icon: Palette },
    { id: 'data', label: 'Data & Sync', icon: Database },
    { id: 'notifications', label: 'Notifications', icon: Bell },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header */}
      <header className="border-b border-slate-200 bg-white/80 shadow-sm backdrop-blur-sm">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="flex items-center gap-2 text-slate-600 transition-colors hover:text-slate-900"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="font-medium">Back to Home</span>
              </Link>
              <div className="h-6 w-px bg-slate-300"></div>
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 p-2 shadow-md">
                  <Shield className="h-5 w-5 text-white" />
                </div>
                <h1 className="text-xl font-bold text-slate-900">Settings</h1>
              </div>
            </div>
            <HeaderAuthButton />
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-4">
          {/* Sidebar */}
          <div className="lg:col-span-1">
            <div className="rounded-lg bg-white p-6 shadow-md">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                  <User className="text-blue-600" size={24} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {user?.displayName || user?.username}
                  </h3>
                  <p className="text-sm text-gray-600">{user?.email}</p>
                  {user?.isDM && (
                    <div className="mt-1 flex items-center gap-1 text-xs text-purple-600">
                      <Crown size={12} />
                      Dungeon Master
                    </div>
                  )}
                </div>
              </div>

              <nav className="space-y-2">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                        activeTab === tab.id
                          ? 'bg-blue-100 text-blue-700'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      <Icon size={16} />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <div className="rounded-lg bg-white p-8 shadow-md">
              {activeTab === 'profile' && <ProfileTab />}
              {activeTab === 'preferences' && <PreferencesTab />}
              {activeTab === 'data' && <DataSyncTab />}
              {activeTab === 'notifications' && <NotificationsTab />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProfileTab() {
  const { user } = useAuth();
  
  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold text-gray-900">Profile Settings</h2>
      
      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Display Name
          </label>
          <input
            type="text"
            defaultValue={user?.displayName || ''}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            placeholder="Your display name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email Address
          </label>
          <input
            type="email"
            defaultValue={user?.email || ''}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            disabled
          />
          <p className="mt-1 text-xs text-gray-500">
            Email changes are not currently supported
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Username
          </label>
          <input
            type="text"
            defaultValue={user?.username || ''}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            disabled
          />
          <p className="mt-1 text-xs text-gray-500">
            Username changes are not currently supported
          </p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="isDM"
            checked={user?.isDM || false}
            disabled
            className="rounded border-gray-300"
          />
          <label htmlFor="isDM" className="text-sm text-gray-700">
            Dungeon Master Account
          </label>
        </div>

        <button className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700">
          <Save size={16} />
          Save Changes
        </button>
      </div>
    </div>
  );
}

function PreferencesTab() {
  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold text-gray-900">Preferences</h2>
      
      <div className="space-y-6">
        <div>
          <h3 className="mb-3 text-lg font-semibold text-gray-800">Theme</h3>
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input type="radio" name="theme" value="light" defaultChecked className="text-blue-600" />
              <span className="text-sm text-gray-700">Light Mode</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="theme" value="dark" className="text-blue-600" />
              <span className="text-sm text-gray-700">Dark Mode (Coming Soon)</span>
            </label>
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-lg font-semibold text-gray-800">Dice Settings</h3>
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" defaultChecked className="rounded border-gray-300 text-blue-600" />
              <span className="text-sm text-gray-700">Enable 3D dice animations</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" defaultChecked className="rounded border-gray-300 text-blue-600" />
              <span className="text-sm text-gray-700">Show dice roll history</span>
            </label>
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-lg font-semibold text-gray-800">Auto-Save</h3>
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" defaultChecked className="rounded border-gray-300 text-blue-600" />
              <span className="text-sm text-gray-700">Auto-save character changes</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" defaultChecked className="rounded border-gray-300 text-blue-600" />
              <span className="text-sm text-gray-700">Sync changes to cloud</span>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

function DataSyncTab() {
  const handleMigrationComplete = (result: unknown) => {
    console.log('Migration completed:', result);
    // Optionally refresh data or show success message
  };

  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold text-gray-900">Data & Synchronization</h2>
      
      <div className="space-y-8">
        <div className="rounded-lg bg-blue-50 p-4">
          <h3 className="mb-2 font-semibold text-blue-900">Sync Status</h3>
          <div className="flex items-center gap-2">
            <SyncIndicator />
          </div>
        </div>

        {/* Character ID Migration Panel */}
        <CharacterIdMigrationPanel />

        {/* Backend Migration Panel */}
        <MigrationPanel onMigrationComplete={handleMigrationComplete} />

        <div>
          <h3 className="mb-3 text-lg font-semibold text-gray-800">Data Management</h3>
          <div className="space-y-3">
            <button className="flex w-full items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50">
              <Download size={16} />
              Export All Characters
            </button>
            <button className="flex w-full items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50">
              <Upload size={16} />
              Import Characters
            </button>
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-lg font-semibold text-gray-800">Storage Usage</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Characters</span>
              <span className="font-medium text-gray-600">3 characters</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Campaigns</span>
              <span className="font-medium text-gray-600">1 campaign</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Total Storage</span>
              <span className="font-medium text-gray-600">2.4 MB</span>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-200 pt-6">
          <h3 className="mb-3 text-lg font-semibold text-red-600">Danger Zone</h3>
          <button className="flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700">
            <Trash2 size={16} />
            Delete All Data
          </button>
          <p className="mt-2 text-xs text-gray-500">
            This will permanently delete all your characters and campaign data.
          </p>
        </div>
      </div>
    </div>
  );
}

function NotificationsTab() {
  return (
    <div>
      <h2 className="mb-6 text-2xl font-bold text-gray-900">Notification Settings</h2>
      
      <div className="space-y-6">
        <div>
          <h3 className="mb-3 text-lg font-semibold text-gray-800">Campaign Notifications</h3>
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" defaultChecked className="rounded border-gray-300 text-blue-600" />
              <span className="text-sm text-gray-700">Campaign invitations</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" defaultChecked className="rounded border-gray-300 text-blue-600" />
              <span className="text-sm text-gray-700">Session reminders</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="rounded border-gray-300 text-blue-600" />
              <span className="text-sm text-gray-700">Character updates from other players</span>
            </label>
          </div>
        </div>

        <div>
          <h3 className="mb-3 text-lg font-semibold text-gray-800">System Notifications</h3>
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" defaultChecked className="rounded border-gray-300 text-blue-600" />
              <span className="text-sm text-gray-700">Sync status updates</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="rounded border-gray-300 text-blue-600" />
              <span className="text-sm text-gray-700">Feature announcements</span>
            </label>
          </div>
        </div>

        <div className="rounded-lg bg-yellow-50 p-4">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> Browser notifications require permission. 
            Real-time notifications are currently in development.
          </p>
        </div>
      </div>
    </div>
  );
}
