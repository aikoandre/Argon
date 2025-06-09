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
  <div className="flex flex-row items-center gap-2 p-2 border-b border-app-border bg-app-panel">
    {icons.map(({ key, icon, label, onClick }) => (
      <button
        key={key}
        className="p-2 rounded-full hover:bg-app-surface/60 focus:outline-none focus:ring-2 focus:ring-app-primary"
        title={label}
        aria-label={label}
        onClick={props[onClick]}
        disabled={props.disabled}
        type="button"
      >
        <MaterialIcon icon={icon} />
      </button>
    ))}
  </div>
);

export default IconActionBar;
