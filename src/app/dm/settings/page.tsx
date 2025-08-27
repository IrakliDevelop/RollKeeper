'use client';

import { Settings, Download, Upload, Trash2 } from 'lucide-react';

export default function DMSettingsPage() {
  return (
    <div className="dm-settings-page">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-slate-800">DM Settings</h1>
        <p className="text-slate-600">
          Configure your Dungeon Master preferences and automation settings.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* General Settings */}
        <div className="rounded-lg bg-white p-6 shadow-md">
          <div className="mb-4 flex items-center">
            <Settings className="mr-2 h-6 w-6 text-slate-600" />
            <h2 className="text-xl font-semibold text-slate-800">
              General Settings
            </h2>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-slate-800">
                  Auto-save frequency
                </h3>
                <p className="text-sm text-slate-600">
                  How often to save campaign data
                </p>
              </div>
              <select className="rounded-md border border-slate-300 px-3 py-1 text-sm">
                <option>Every 30 seconds</option>
                <option>Every minute</option>
                <option>Every 5 minutes</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-slate-800">Theme</h3>
                <p className="text-sm text-slate-600">Interface appearance</p>
              </div>
              <select className="rounded-md border border-slate-300 px-3 py-1 text-sm">
                <option>Light</option>
                <option>Dark</option>
                <option>Auto</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-slate-800">
                  Backup retention
                </h3>
                <p className="text-sm text-slate-600">
                  Number of campaign backups to keep
                </p>
              </div>
              <input
                type="number"
                min="1"
                max="50"
                defaultValue="10"
                className="w-20 rounded-md border border-slate-300 px-3 py-1 text-sm"
              />
            </div>
          </div>
        </div>

        {/* Automation Settings */}
        <div className="rounded-lg bg-white p-6 shadow-md">
          <h2 className="mb-4 text-xl font-semibold text-slate-800">
            Automation
          </h2>

          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="autoInitiative"
                className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
              />
              <label
                htmlFor="autoInitiative"
                className="ml-2 text-sm text-slate-700"
              >
                Auto-roll initiative for monsters
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="autoConditions"
                className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
              />
              <label
                htmlFor="autoConditions"
                className="ml-2 text-sm text-slate-700"
              >
                Auto-remove expired conditions
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="autoTurnAdvance"
                className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
              />
              <label
                htmlFor="autoTurnAdvance"
                className="ml-2 text-sm text-slate-700"
              >
                Auto-advance turns in combat
              </label>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="autoSpellSlots"
                className="h-4 w-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
              />
              <label
                htmlFor="autoSpellSlots"
                className="ml-2 text-sm text-slate-700"
              >
                Track spell slot usage automatically
              </label>
            </div>
          </div>
        </div>

        {/* Data Management */}
        <div className="rounded-lg bg-white p-6 shadow-md">
          <h2 className="mb-4 text-xl font-semibold text-slate-800">
            Data Management
          </h2>

          <div className="space-y-4">
            <button className="flex w-full items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700">
              <Download size={16} />
              Export All Campaign Data
            </button>

            <button className="flex w-full items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white transition-colors hover:bg-green-700">
              <Upload size={16} />
              Import Campaign Data
            </button>

            <div className="border-t border-slate-200 pt-4">
              <button className="flex w-full items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700">
                <Trash2 size={16} />
                Clear All DM Data
              </button>
              <p className="mt-2 text-xs text-slate-500">
                This will permanently delete all campaigns, characters, and
                settings. Character sheets remain unaffected.
              </p>
            </div>
          </div>
        </div>

        {/* Beta Information */}
        <div className="rounded-lg border border-purple-200 bg-gradient-to-r from-purple-50 to-blue-50 p-6">
          <h2 className="mb-4 text-xl font-semibold text-slate-800">
            Beta Features
          </h2>
          <div className="space-y-2 text-sm text-slate-600">
            <p>🚧 Combat Tracker - Coming in Phase 4</p>
            <p>🚧 Character Import - Coming in Phase 3</p>
            <p>🚧 Advanced Automation - Coming in Phase 5</p>
            <p>🚧 Multiplayer Support - Future release</p>
          </div>
          <div className="mt-4 border-t border-purple-200 pt-4">
            <p className="text-xs text-slate-500">
              DM Toolset is actively being developed. New features will be added
              while maintaining full compatibility with existing character
              sheets.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
