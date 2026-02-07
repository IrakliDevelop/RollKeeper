import { Save, Check, AlertCircle, Loader2 } from 'lucide-react';
import { SaveStatus } from '@/types/character';

interface SaveIndicatorProps {
  status: SaveStatus;
  lastSaved?: Date | string | null;
  hasUnsavedChanges?: boolean;
  className?: string;
}

export const SaveIndicator = ({
  status,
  lastSaved,
  hasUnsavedChanges = false,
  className = '',
}: SaveIndicatorProps) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'saving':
        return {
          icon: <Loader2 size={12} className="animate-spin" />,
          text: 'Saving...',
          dotColor: 'bg-yellow-500',
          textColor: 'text-yellow-700 dark:text-yellow-400',
        };
      case 'saved':
        return {
          icon: <Check size={12} />,
          text: hasUnsavedChanges ? 'Changes pending' : 'All changes saved',
          dotColor: hasUnsavedChanges ? 'bg-yellow-500' : 'bg-green-500',
          textColor: hasUnsavedChanges
            ? 'text-yellow-700 dark:text-yellow-400'
            : 'text-green-700 dark:text-green-400',
        };
      case 'error':
        return {
          icon: <AlertCircle size={12} />,
          text: 'Save failed',
          dotColor: 'bg-red-500',
          textColor: 'text-red-700 dark:text-red-400',
        };
      default:
        return {
          icon: <Save size={12} />,
          text: 'Not saved',
          dotColor: 'bg-faint',
          textColor: 'text-body',
        };
    }
  };

  const config = getStatusConfig();

  const formatLastSaved = (date: Date | string) => {
    const now = new Date();
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const diffInSeconds = Math.floor(
      (now.getTime() - dateObj.getTime()) / 1000
    );

    if (diffInSeconds < 30) {
      return 'just now';
    } else if (diffInSeconds < 60) {
      return `${diffInSeconds}s ago`;
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}m ago`;
    } else {
      return dateObj.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });
    }
  };

  return (
    <div className={`flex items-center gap-2 text-sm ${className}`}>
      <span className={`h-2 w-2 rounded-full ${config.dotColor}`}></span>
      <div className="flex items-center gap-1">
        <span className={config.textColor}>{config.icon}</span>
        <span className={config.textColor}>{config.text}</span>
      </div>
      {lastSaved && status === 'saved' && !hasUnsavedChanges && (
        <span className="text-muted text-xs">
          • {formatLastSaved(lastSaved)}
        </span>
      )}
    </div>
  );
};
