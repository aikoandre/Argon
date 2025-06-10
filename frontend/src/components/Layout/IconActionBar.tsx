import React from 'react';

interface IconActionBarProps {
  onDelete?: () => void;
  onImport?: () => void;
  onExport?: () => void;
  onExpressions?: () => void;
  onImageChange?: () => void;
  disabled?: boolean;
}

const icons = [
  { key: 'delete', icon: 'delete', label: 'Delete', onClick: 'onDelete' },
  { key: 'import', icon: 'file_upload', label: 'Import', onClick: 'onImport' },
  { key: 'export', icon: 'file_download', label: 'Export', onClick: 'onExport' },
  { key: 'expressions', icon: 'face', label: 'Expressions', onClick: 'onExpressions' },
  { key: 'image', icon: 'image', label: 'Change Image', onClick: 'onImageChange' },
];

const MaterialIcon = ({ icon, className = "" }: { icon: string; className?: string }) => (
  <span className={`material-icons-outlined text-2xl ${className}`}>{icon}</span>
);

const IconActionBar: React.FC<IconActionBarProps> = (props) => (
  <div className="flex flex-row items-center justify-center gap-2 p-2 border-b border-app-border bg-app-surface">
    {icons.map(({ key, icon, label, onClick }) => (
      <button
        key={key}
        className="px-1 rounded-lg border-2 border-app-bg hover:bg-app-bg/60 focus:outline-none focus:ring-2 focus:ring-app-primary"
        title={label}
        aria-label={label}
        onClick={props[onClick as keyof IconActionBarProps] as (() => void) | undefined}
        disabled={props.disabled}
        type="button"
      >
        <MaterialIcon icon={icon} />
      </button>
    ))}
  </div>
);

export default IconActionBar;
