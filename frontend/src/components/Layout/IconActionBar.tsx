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
  <span className={`material-icons-outlined text-xl ${className}`}>{icon}</span>
);

const IconActionBar: React.FC<IconActionBarProps> = (props) => (
  <div className="p-1.5 flex flex-row items-center justify-between border-b border-app-border bg-app-bg">
    <h3 className="text-lg font-semibold text-app-text flex items-center gap-2">
      <span className="material-icons-outlined text-xl pl-3">edit</span>
      Edit
    </h3>
    <div className="flex items-center gap-6 pr-5">
    {icons.map(({ key, icon, label, onClick }) => {
      const clickHandler = props[onClick as keyof IconActionBarProps] as (() => void) | undefined;
      return (
        <button
          key={key}
          className="text-app-text-secondary"
          title={label}
          aria-label={label}
          onClick={() => {
            console.log(`IconActionBar: ${label} clicked`);
            if (clickHandler) {
              clickHandler();
            } else {
              console.log(`IconActionBar: No handler for ${label}`);
            }
          }}
          disabled={props.disabled}
          type="button"
        >
          <MaterialIcon icon={icon} />
        </button>
      );
    })}
    </div>
  </div>
);

export default IconActionBar;
