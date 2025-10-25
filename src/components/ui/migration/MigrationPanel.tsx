import React, { useState, useEffect } from 'react';
import {
  Upload,
  Download,
  AlertTriangle,
  CheckCircle,
  XCircle,
  RefreshCw,
  FileText,
  Shield,
  Info,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePlayerStore } from '@/store/playerStore';
import {
  migrateCharactersToBackend,
  getMigrationPreview,
  backupLocalStorageData,
  validateMigrationData,
  type MigrationResult,
  type MigrationOptions,
} from '@/utils/migration';

interface MigrationPanelProps {
  onMigrationComplete?: (result: MigrationResult) => void;
}

export function MigrationPanel({ onMigrationComplete }: MigrationPanelProps) {
  const { isAuthenticated } = useAuth();
  const { characters } = usePlayerStore();
  
  const [migrationState, setMigrationState] = useState<'idle' | 'preview' | 'migrating' | 'completed'>('idle');
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);
  const [migrationOptions, setMigrationOptions] = useState<MigrationOptions>({
    overwriteExisting: false,
    dryRun: false,
    batchSize: 3,
  });
  const [backupData, setBackupData] = useState<string>('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Get migration preview
  const preview = getMigrationPreview(characters);
  const validation = validateMigrationData(characters);

  useEffect(() => {
    if (migrationState === 'preview') {
      // Create backup when user requests preview
      const backup = backupLocalStorageData();
      setBackupData(backup);
    }
  }, [migrationState]);

  const handleStartMigration = async () => {
    if (!isAuthenticated || !validation.isValid) return;

    setMigrationState('migrating');
    setMigrationResult(null);

    try {
      const result = await migrateCharactersToBackend(characters, migrationOptions);
      setMigrationResult(result);
      setMigrationState('completed');
      
      if (onMigrationComplete) {
        onMigrationComplete(result);
      }
    } catch (error) {
      setMigrationResult({
        success: false,
        migratedCount: 0,
        skippedCount: 0,
        errors: [{
          characterName: 'Migration',
          error: error instanceof Error ? error.message : 'Unknown error',
        }],
      });
      setMigrationState('completed');
    }
  };

  const handleDownloadBackup = () => {
    if (!backupData) return;

    const blob = new Blob([backupData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rollkeeper-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const reset = () => {
    setMigrationState('idle');
    setMigrationResult(null);
    setBackupData('');
  };

  if (!isAuthenticated) {
    return (
      <div className="rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Upload className="h-6 w-6 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Character Migration</h3>
        </div>
        <div className="flex items-center gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <AlertTriangle className="h-5 w-5 text-yellow-600" />
          <p className="text-yellow-800">Please sign in to migrate your characters to the cloud.</p>
        </div>
      </div>
    );
  }

  if (characters.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Upload className="h-6 w-6 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">Character Migration</h3>
        </div>
        <div className="flex items-center gap-2 p-4 bg-gray-50 border border-gray-200 rounded-lg">
          <Info className="h-5 w-5 text-gray-600" />
          <p className="text-gray-700">No local characters found to migrate.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 p-6">
      <div className="flex items-center gap-3 mb-6">
        <Upload className="h-6 w-6 text-blue-600" />
        <h3 className="text-lg font-semibold text-gray-900">Character Migration</h3>
      </div>

      {/* Validation Issues */}
      {!validation.isValid && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <XCircle className="h-5 w-5 text-red-600" />
            <h4 className="font-medium text-red-800">Data Validation Issues</h4>
          </div>
          <ul className="text-sm text-red-700 space-y-1">
            {validation.issues.map((issue, index) => (
              <li key={index}>• {issue}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Migration Preview */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-medium text-blue-800 mb-3">Migration Preview</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-blue-600 font-medium">{preview.total}</span>
            <p className="text-blue-700">Total Characters</p>
          </div>
          <div>
            <span className="text-green-600 font-medium">{preview.localOnly}</span>
            <p className="text-blue-700">Local Only</p>
          </div>
          <div>
            <span className="text-yellow-600 font-medium">{preview.duplicates.length}</span>
            <p className="text-blue-700">Potential Duplicates</p>
          </div>
          <div>
            <span className="text-purple-600 font-medium">{migrationOptions.batchSize}</span>
            <p className="text-blue-700">Batch Size</p>
          </div>
        </div>
        
        {preview.duplicates.length > 0 && (
          <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
            <p className="text-sm text-yellow-800">
              <strong>Potential duplicates:</strong> {preview.duplicates.join(', ')}
            </p>
          </div>
        )}
      </div>

      {/* Migration Options */}
      <div className="mb-6">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800 mb-3"
        >
          <Shield className="h-4 w-4" />
          Advanced Options
        </button>
        
        {showAdvanced && (
          <div className="space-y-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={migrationOptions.overwriteExisting}
                onChange={(e) => setMigrationOptions(prev => ({
                  ...prev,
                  overwriteExisting: e.target.checked
                }))}
                className="rounded border-gray-300"
              />
              <span className="text-sm">Overwrite existing characters with same name</span>
            </label>
            
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={migrationOptions.dryRun}
                onChange={(e) => setMigrationOptions(prev => ({
                  ...prev,
                  dryRun: e.target.checked
                }))}
                className="rounded border-gray-300"
              />
              <span className="text-sm">Dry run (preview only, don&apos;t actually migrate)</span>
            </label>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Batch Size: {migrationOptions.batchSize}
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={migrationOptions.batchSize}
                onChange={(e) => setMigrationOptions(prev => ({
                  ...prev,
                  batchSize: parseInt(e.target.value)
                }))}
                className="w-full"
              />
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3">
        {migrationState === 'idle' && (
          <>
            <button
              onClick={() => setMigrationState('preview')}
              disabled={!validation.isValid}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileText className="h-4 w-4" />
              Preview Migration
            </button>
          </>
        )}

        {migrationState === 'preview' && (
          <>
            <button
              onClick={handleStartMigration}
              disabled={!validation.isValid}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="h-4 w-4" />
              {migrationOptions.dryRun ? 'Run Preview' : 'Start Migration'}
            </button>
            
            <button
              onClick={handleDownloadBackup}
              className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              <Download className="h-4 w-4" />
              Download Backup
            </button>
            
            <button
              onClick={reset}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </>
        )}

        {migrationState === 'migrating' && (
          <div className="flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-800 rounded-lg">
            <RefreshCw className="h-4 w-4 animate-spin" />
            Migrating characters...
          </div>
        )}

        {migrationState === 'completed' && (
          <button
            onClick={reset}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            Start New Migration
          </button>
        )}
      </div>

      {/* Migration Results */}
      {migrationResult && (
        <div className="mt-6 p-4 border rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            {migrationResult.success ? (
              <CheckCircle className="h-5 w-5 text-green-600" />
            ) : (
              <XCircle className="h-5 w-5 text-red-600" />
            )}
            <h4 className={`font-medium ${migrationResult.success ? 'text-green-800' : 'text-red-800'}`}>
              Migration {migrationResult.success ? 'Completed' : 'Failed'}
            </h4>
          </div>

          <div className="grid grid-cols-3 gap-4 text-sm mb-4">
            <div>
              <span className="text-green-600 font-medium">{migrationResult.migratedCount}</span>
              <p className="text-gray-600">Migrated</p>
            </div>
            <div>
              <span className="text-yellow-600 font-medium">{migrationResult.skippedCount}</span>
              <p className="text-gray-600">Skipped</p>
            </div>
            <div>
              <span className="text-red-600 font-medium">{migrationResult.errors.length}</span>
              <p className="text-gray-600">Errors</p>
            </div>
          </div>

          {migrationResult.errors.length > 0 && (
            <div className="space-y-2">
              <h5 className="font-medium text-red-800">Errors:</h5>
              {migrationResult.errors.map((error, index) => (
                <div key={index} className="text-sm text-red-700 bg-red-50 p-2 rounded">
                  <strong>{error.characterName}:</strong> {error.error}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
