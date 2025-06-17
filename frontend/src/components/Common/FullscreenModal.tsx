import React, { useCallback } from 'react';

interface FullscreenModalProps {
  isOpen: boolean;
  title: string;
  value: string;
  placeholder?: string;
  disabled?: boolean;
  onClose: () => void;
  onChange: (value: string) => void;
}

const FullscreenModal: React.FC<FullscreenModalProps> = React.memo(({
  isOpen,
  title,
  value,
  placeholder = '',
  disabled = false,
  onClose,
  onChange
}) => {
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  }, [onChange]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-app-surface rounded-lg shadow-xl w-11/12 h-5/6 max-w-4xl flex flex-col">
        <div className="flex justify-between items-center p-4 border-b border-app-border">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="text-app-text-2 hover:text-app-text transition-colors p-1"
            disabled={disabled}
          >
            <span className="material-icons-outlined">close</span>
          </button>
        </div>
        <div className="flex-1 p-4">
          <textarea
            className="w-full h-full p-4 rounded bg-app-bg border-2 border-app-border focus:outline-none focus:border-app-text focus:ring-0 resize-none scrollbar-thin scrollbar-track-app-bg scrollbar-thumb-app-border"
            value={value}
            onChange={handleChange}
            placeholder={placeholder}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
});

export default FullscreenModal;
