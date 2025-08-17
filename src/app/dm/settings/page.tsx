'use client';

import { Settings, Download, Upload, Trash2 } from 'lucide-react';

export default function DMSettingsPage() {
  return (
    <div className="dm-settings-page">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">
          DM Settings
        </h1>
        <p className="text-slate-600">
          Configure your Dungeon Master preferences and automation settings.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* General Settings */}
        <div className="bg-white rounded-lg p-6 shadow-md">
          <div className="flex items-center mb-4">
            <Settings className="h-6 w-6 text-slate-600 mr-2" />
            <h2 className="text-xl font-semibold text-slate-800">General Settings</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-slate-800">Auto-save frequency</h3>
                <p className="text-sm text-slate-600">How often to save campaign data</p>
              </div>
              <select className="px-3 py-1 border border-slate-300 rounded-md text-sm">
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
              <select className="px-3 py-1 border border-slate-300 rounded-md text-sm">
                <option>Light</option>
                <option>Dark</option>
                <option>Auto</option>
              </select>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-medium text-slate-800">Backup retention</h3>
                <p className="text-sm text-slate-600">Number of campaign backups to keep</p>
              </div>
              <input 
                type="number" 
                min="1" 
                max="50" 
                defaultValue="10"
                className="w-20 px-3 py-1 border border-slate-300 rounded-md text-sm"
              />
            </div>
          </div>
        </div>

        {/* Automation Settings */}
        <div className="bg-white rounded-lg p-6 shadow-md">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">Automation</h2>
          
          <div className="space-y-4">
            <div className="flex items-center">
              <input
                type="checkbox"
                id="autoInitiative"
                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-slate-300 rounded"
              />
              <label htmlFor="autoInitiative" className="ml-2 text-sm text-slate-700">
                Auto-roll initiative for monsters
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="autoConditions"
                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-slate-300 rounded"
              />
              <label htmlFor="autoConditions" className="ml-2 text-sm text-slate-700">
                Auto-remove expired conditions
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="autoTurnAdvance"
                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-slate-300 rounded"
              />
              <label htmlFor="autoTurnAdvance" className="ml-2 text-sm text-slate-700">
                Auto-advance turns in combat
              </label>
            </div>
            
            <div className="flex items-center">
              <input
                type="checkbox"
                id="autoSpellSlots"
                className="h-4 w-4 text-purple-600 focus:ring-purple-500 border-slate-300 rounded"
              />
              <label htmlFor="autoSpellSlots" className="ml-2 text-sm text-slate-700">
                Track spell slot usage automatically
              </label>
            </div>
          </div>
        </div>

        {/* Data Management */}
        <div className="bg-white rounded-lg p-6 shadow-md">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">Data Management</h2>
          
          <div className="space-y-4">
            <button className="flex items-center gap-2 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              <Download size={16} />
              Export All Campaign Data
            </button>
            
            <button className="flex items-center gap-2 w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
              <Upload size={16} />
              Import Campaign Data
            </button>
            
            <div className="pt-4 border-t border-slate-200">
              <button className="flex items-center gap-2 w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                <Trash2 size={16} />
                Clear All DM Data
              </button>
              <p className="text-xs text-slate-500 mt-2">
                This will permanently delete all campaigns, characters, and settings. Character sheets remain unaffected.
              </p>
            </div>
          </div>
        </div>

        {/* Beta Information */}
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-6">
          <h2 className="text-xl font-semibold text-slate-800 mb-4">Beta Features</h2>
          <div className="space-y-2 text-sm text-slate-600">
            <p>🚧 Combat Tracker - Coming in Phase 4</p>
            <p>🚧 Character Import - Coming in Phase 3</p>
            <p>🚧 Advanced Automation - Coming in Phase 5</p>
            <p>🚧 Multiplayer Support - Future release</p>
          </div>
          <div className="mt-4 pt-4 border-t border-purple-200">
            <p className="text-xs text-slate-500">
              DM Toolset is actively being developed. New features will be added while maintaining full compatibility with existing character sheets.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
