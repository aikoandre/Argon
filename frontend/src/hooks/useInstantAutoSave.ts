import { useEffect, useState, useCallback, useRef } from 'react';

export type SaveStatus = 'saved' | 'saving' | 'error' | 'conflict';

interface UseInstantAutoSaveOptions {
  debounceMs?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
}

export const useInstantAutoSave = <T>(
  data: T,
  saveFunction: (data: T) => Promise<void>,
  options: UseInstantAutoSaveOptions = {}
) => {
  const {
    debounceMs = 300,
    retryAttempts = 3,
    retryDelayMs = 1000
  } = options;

  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const [lastSavedData, setLastSavedData] = useState<T>(data);
  const [error, setError] = useState<Error | null>(null);
  
  const saveTimeoutRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);
  const isInitialRef = useRef(true);

  const saveData = useCallback(async (dataToSave: T) => {
    try {
      setSaveStatus('saving');
      setError(null);
      
      await saveFunction(dataToSave);
      
      setLastSavedData(dataToSave);
      setSaveStatus('saved');
      retryCountRef.current = 0;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Save failed');
      setError(error);
      
      if (retryCountRef.current < retryAttempts) {
        retryCountRef.current++;
        setTimeout(() => saveData(dataToSave), retryDelayMs);
      } else {
        setSaveStatus('error');
        retryCountRef.current = 0;
      }
    }
  }, [saveFunction, retryAttempts, retryDelayMs]);

  useEffect(() => {
    // Skip auto-save on initial mount
    if (isInitialRef.current) {
      isInitialRef.current = false;
      return;
    }

    // Only save if data actually changed
    if (JSON.stringify(data) === JSON.stringify(lastSavedData)) {
      return;
    }

    // Clear any existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout for debounced save
    saveTimeoutRef.current = setTimeout(() => {
      saveData(data);
    }, debounceMs);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [data, lastSavedData, debounceMs, saveData]);

  const forceSave = useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    saveData(data);
  }, [data, saveData]);

  const retry = useCallback(() => {
    retryCountRef.current = 0;
    saveData(data);
  }, [data, saveData]);

  return {
    saveStatus,
    lastSavedData,
    error,
    forceSave,
    retry,
    hasUnsavedChanges: JSON.stringify(data) !== JSON.stringify(lastSavedData)
  };
};