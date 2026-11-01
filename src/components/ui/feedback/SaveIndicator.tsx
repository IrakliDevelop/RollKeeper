import { Save, Check, AlertCircle, Loader2 } from 'lucide-react';
import { SaveStatus } from '@/types/character';

interface SaveIndicatorProps {
  status: SaveStatus;
  lastSaved?: Date | string | null;
  hasUnsavedChanges?: boolean;
  className?: string;
  /** Extra classes for the status text and time, e.g. to hide them on phones. */
  textClassName?: string;
}

export const SaveIndicator = ({
  status,
  lastSaved,
  hasUnsavedChanges = false,
  className = '',
  textClassName = '',
}: SaveIndicatorProps) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'saving':
        return {
          icon: <Loader2 size={12} className="animate-spin" />,
          text: 'Saving…',
          dotColor: 'bg-muted',
          textColor: 'text-muted',
        };
      case 'saved':
        return {
          icon: <Check size={12} />,
          text: hasUnsavedChanges ? 'Changes pending' : 'All changes saved',
          dotColor: 'bg-muted',
          textColor: 'text-muted',
        };
      case 'saved-local':
        return {
          icon: <Check size={12} />,
          text: 'Saved on this device',
          dotColor: 'bg-muted',
          textColor: 'text-muted',
        };
      case 'saved-local-mirror-pending':
        return {
          icon: <AlertCircle size={12} />,
          text: 'Saved on this device',
          dotColor: 'bg-muted',
          textColor: 'text-muted',
        };
      case 'error':
        return {
          icon: <AlertCircle size={12} />,
          text: "Couldn't save on this device",
          dotColor: 'bg-muted',
          textColor: 'text-muted',
        };
      default:
        return {
          icon: <Save size={12} />,
          text: 'Not saved',
          dotColor: 'bg-muted',
          textColor: 'text-muted',
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
        <span className={`${config.textColor} ${textClassName}`}>
          {config.text}
        </span>
      </div>
      {lastSaved &&
        (status === 'saved' ||
          status === 'saved-local' ||
          status === 'saved-local-mirror-pending') &&
        !hasUnsavedChanges && (
          <span className={`text-muted text-xs ${textClassName}`}>
            • {formatLastSaved(lastSaved)}
          </span>
        )}
    </div>
  );
};
