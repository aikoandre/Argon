import React from 'react';
import type { SaveStatus } from '../../hooks/useInstantAutoSave';

interface SaveIndicatorProps {
  status: SaveStatus;
  lastSaved?: Date;
  onRetry?: () => void;
  onResolveConflict?: () => void;
  error?: Error | null;
}

const SaveIndicator: React.FC<SaveIndicatorProps> = ({
  status,
  lastSaved,
  onRetry,
  onResolveConflict,
  error
}) => {
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  switch (status) {
    case 'saving':
      return (
        <div className="flex items-center gap-2 text-yellow-400 text-sm">
          <div className="animate-spin w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full"></div>
          <span>Saving...</span>
        </div>
      );

    case 'saved':
      return (
        <div className="flex items-center gap-2 text-green-400 text-sm">
          <span className="material-icons-outlined text-base">check_circle</span>
          <span>
            {lastSaved ? `Saved at ${formatTime(lastSaved)}` : 'Saved'}
          </span>
        </div>
      );

    case 'error':
      return (
        <div className="flex items-center gap-2 text-red-400 text-sm">
          <span className="material-icons-outlined text-base">error</span>
          <span>Save failed</span>
          {error && (
            <span className="text-xs opacity-75">({error.message})</span>
          )}
          {onRetry && (
            <button
              onClick={onRetry}
              className="ml-2 px-2 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 focus:outline-none focus:ring-1 focus:ring-red-400"
            >
              Retry
            </button>
          )}
        </div>
      );

    case 'conflict':
      return (
        <div className="flex items-center gap-2 text-orange-400 text-sm">
          <span className="material-icons-outlined text-base">warning</span>
          <span>Conflict detected</span>
          {onResolveConflict && (
            <button
              onClick={onResolveConflict}
              className="ml-2 px-2 py-1 bg-orange-500 text-white text-xs rounded hover:bg-orange-600 focus:outline-none focus:ring-1 focus:ring-orange-400"
            >
              Resolve
            </button>
          )}
        </div>
      );

    default:
      return null;
  }
};

export default SaveIndicator;