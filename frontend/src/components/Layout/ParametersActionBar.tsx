import React from 'react';

interface ParametersActionBarProps {
  title?: string;
  icon?: string;
  onImport?: () => void;
  onExport?: () => void;
  onSave?: () => void;
  onRename?: () => void;
  onDelete?: () => void;
  disabled?: boolean;
}

interface ActionButton {
  key: string;
  icon: string;
  label: string;
  onClick: 'onImport' | 'onExport' | 'onSave' | 'onRename' | 'onDelete';
  className?: string;
}

const actionButtons: ActionButton[] = [  { 
    key: 'import', 
    icon: 'file_upload', 
    label: 'Import Preset', 
    onClick: 'onImport',
  },
  { 
    key: 'export', 
    icon: 'file_download', 
    label: 'Export Preset', 
    onClick: 'onExport',
  },
  { 
    key: 'save', 
    icon: 'save', 
    label: 'Save Current Parameters & Prompts', 
    onClick: 'onSave',
  },
  { 
    key: 'rename', 
    icon: 'edit', 
    label: 'Rename Preset', 
    onClick: 'onRename',
  },
  { 
    key: 'delete', 
    icon: 'delete', 
    label: 'Delete Preset', 
    onClick: 'onDelete',
  },
];

const ParametersActionBar: React.FC<ParametersActionBarProps> = ({
  title = "Parameters",
  icon = "tune",
  disabled = false,  ...handlers
}) => {
  return (
    <div className="flex items-center justify-between bg-app-bg p-1.5 border-b border-app-border">
      <h3 className="text-lg font-semibold text-app-text flex items-center gap-2">
        <span className="material-icons-outlined text-xl pl-3">{icon}</span>
        {title}
      </h3>
      
      {/* Action buttons */}
      <div className="flex items-center gap-4 pr-2">
        {actionButtons.map(({ key, icon, label, onClick, className }) => {
          const clickHandler = handlers[onClick] as (() => void) | undefined;          
          if (!clickHandler) return null;
          
          return (
            <button
              key={key}
              onClick={clickHandler}
              className={className}
              title={label}
              disabled={disabled}
              type="button"
            >
              <span className="material-icons-outlined text-xl text-app-text-secondary group-hover:text-app-text">
                {icon}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ParametersActionBar;
