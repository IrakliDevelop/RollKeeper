import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  Download,
  RefreshCw,
  Info,
  Zap,
} from 'lucide-react';
import {
  needsCharacterIdMigration,
  migrateCharacterIdsToUUID,
  createBackupBeforeMigration,
  type MigrationReport,
} from '@/utils/characterIdMigration';

export function CharacterIdMigrationPanel() {
  const [needsMigration, setNeedsMigration] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [migrationResult, setMigrationResult] = useState<MigrationReport | null>(null);
  const [backupData, setBackupData] = useState<string>('');
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    checkMigrationNeed();
  }, []);

  const checkMigrationNeed = () => {
    setIsLoading(true);
    try {
      const needs = needsCharacterIdMigration();
      setNeedsMigration(needs);
    } catch (error) {
      console.error('Error checking migration need:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMigration = () => {
    setIsLoading(true);
    
    try {
      // Create backup first
      const backup = createBackupBeforeMigration();
      setBackupData(backup);
      
      // Run migration
      const result = migrateCharacterIdsToUUID();
      setMigrationResult(result);
      
      // Check if migration is still needed
      setNeedsMigration(needsCharacterIdMigration());
    } catch (error) {
      console.error('Migration error:', error);
      setMigrationResult({
        totalCharacters: 0,
        migratedCharacters: 0,
        skippedCharacters: 0,
        errors: [`Migration failed: ${error}`],
      });
    } finally {
      setIsLoading(false);
    }
  };

  const downloadBackup = () => {
    if (!backupData) return;

    const blob = new Blob([backupData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rollkeeper-character-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <RefreshCw className="h-6 w-6 text-blue-600 animate-spin" />
          <h3 className="text-lg font-semibold text-gray-900">Checking Character Data...</h3>
        </div>
        <p className="text-gray-600">Analyzing your character data for compatibility...</p>
      </div>
    );
  }

  if (!needsMigration && !migrationResult) {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6">
        <div className="flex items-center gap-3 mb-4">
          <CheckCircle className="h-6 w-6 text-green-600" />
          <h3 className="text-lg font-semibold text-green-800">Character Data Up to Date</h3>
        </div>
        <p className="text-green-700">
          Your character data is already in the correct format and compatible with the backend.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6">
      <div className="flex items-center gap-3 mb-4">
        <AlertTriangle className="h-6 w-6 text-yellow-600" />
        <h3 className="text-lg font-semibold text-yellow-800">Character ID Migration Required</h3>
      </div>

      {!migrationResult ? (
        <>
          <div className="mb-6">
            <p className="text-yellow-800 mb-3">
              Your character data uses an older ID format that needs to be updated for backend compatibility.
              This is a one-time migration that will update your character IDs to the new UUID format.
            </p>
            
            <div className="bg-yellow-100 border border-yellow-200 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-yellow-600 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-medium mb-1">What this migration does:</p>
                  <ul className="space-y-1">
                    <li>• Updates character IDs to UUID format (required for backend sync)</li>
                    <li>• Preserves all your character data and settings</li>
                    <li>• Creates a backup before making changes</li>
                    <li>• Takes only a few seconds to complete</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleMigration}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Zap className="h-4 w-4" />
              {isLoading ? 'Migrating...' : 'Run Migration'}
            </button>
            
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="px-4 py-2 border border-yellow-300 text-yellow-800 rounded-lg hover:bg-yellow-100"
            >
              {showDetails ? 'Hide Details' : 'Show Details'}
            </button>
          </div>

          {showDetails && (
            <div className="mt-4 p-3 bg-yellow-100 border border-yellow-200 rounded-lg">
              <h4 className="font-medium text-yellow-800 mb-2">Technical Details</h4>
              <p className="text-sm text-yellow-700">
                The backend database uses UUID format for character IDs, but your local characters
                use the legacy format. This migration converts them to be compatible while preserving
                all your data. A backup is automatically created before migration.
              </p>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="mb-4">
            <h4 className="font-medium text-yellow-800 mb-2">Migration Results</h4>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <span className="text-blue-600 font-medium">{migrationResult.totalCharacters}</span>
                <p className="text-yellow-700">Total Characters</p>
              </div>
              <div>
                <span className="text-green-600 font-medium">{migrationResult.migratedCharacters}</span>
                <p className="text-yellow-700">Migrated</p>
              </div>
              <div>
                <span className="text-gray-600 font-medium">{migrationResult.skippedCharacters}</span>
                <p className="text-yellow-700">Already Updated</p>
              </div>
            </div>
          </div>

          {migrationResult.errors.length > 0 && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <h5 className="font-medium text-red-800 mb-2">Errors:</h5>
              {migrationResult.errors.map((error, index) => (
                <p key={index} className="text-sm text-red-700">• {error}</p>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            {backupData && (
              <button
                onClick={downloadBackup}
                className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
              >
                <Download className="h-4 w-4" />
                Download Backup
              </button>
            )}
            
            <button
              onClick={checkMigrationNeed}
              className="px-4 py-2 border border-yellow-300 text-yellow-800 rounded-lg hover:bg-yellow-100"
            >
              <RefreshCw className="h-4 w-4 inline mr-2" />
              Check Again
            </button>
          </div>

          {migrationResult.migratedCharacters > 0 && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                ✅ Migration completed successfully! Your characters are now ready for backend sync.
                You can now use the character migration tools above to sync them to the cloud.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
