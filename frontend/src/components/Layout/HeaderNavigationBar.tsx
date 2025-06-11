import React from 'react';
import { Link, useLocation } from 'react-router-dom';

interface HeaderNavigationBarProps {
  onToggleLeftPanel?: () => void;
  onToggleRightPanel?: () => void;
  leftPanelVisible?: boolean;
  rightPanelVisible?: boolean;
}

const navigationItems = [
  { key: 'leftPanel', icon: 'view_sidebar', label: 'Toggle Left Panel', type: 'button', action: 'onToggleLeftPanel' },
  { key: 'home', icon: 'home', label: 'Home', type: 'link', path: '/', activeWhen: (path: string) => path === '/' },
  { key: 'chat', icon: 'chat', label: 'Chats', type: 'link', path: '/chats', activeWhen: (path: string) => path.startsWith('/chat') },
  { key: 'characters', icon: 'person', label: 'Characters', type: 'link', path: '/characters', activeWhen: (path: string) => path === '/characters' },
  { key: 'scenarios', icon: 'view_list', label: 'Scenarios', type: 'link', path: '/scenarios', activeWhen: (path: string) => path === '/scenarios' },
  { key: 'world-lore', icon: 'public', label: 'Master Worlds', type: 'link', path: '/world-lore', activeWhen: (path: string) => path.startsWith('/world-lore') },
  { key: 'personas', icon: 'groups', label: 'Personas', type: 'link', path: '/personas', activeWhen: (path: string) => path === '/personas' },
  { key: 'settings', icon: 'settings', label: 'Settings', type: 'link', path: '/settings', activeWhen: (path: string) => path === '/settings' },
  { key: 'rightPanel', icon: 'menu', label: 'Toggle Right Panel', type: 'button', action: 'onToggleRightPanel' },
];

const MaterialIcon = ({ icon, className = "" }: { icon: string; className?: string }) => (
  <span className={`material-icons-outlined text-2xl flex-shrink-0 ${className}`}>{icon}</span>
);

const HeaderNavigationBar: React.FC<HeaderNavigationBarProps> = (props) => {
  const location = useLocation();

  const getItemContent = (item: typeof navigationItems[0]) => {
    const isActive = item.activeWhen ? item.activeWhen(location.pathname) : false;
    const isToggleActive = 
      (item.key === 'leftPanel' && props.leftPanelVisible) || 
      (item.key === 'rightPanel' && props.rightPanelVisible);
    
    const className = `px-1 rounded-lg border-2 border-app-bg hover:bg-app-bg/60 focus:outline-none focus:text-app-primary ${
      isActive || isToggleActive ? 'text-app-text' : 'text-app-text-secondary'
    }`;

    if (item.type === 'button') {
      return (
        <button
          key={item.key}
          onClick={props[item.action as keyof HeaderNavigationBarProps] as (() => void) | undefined}
          className={className}
          title={item.label}
          aria-label={item.label}
          type="button"
        >
          <MaterialIcon icon={item.icon} />
        </button>
      );
    }

    return (
      <Link
        key={item.key}
        to={item.path!}
        className={className}
        title={item.label}
        aria-label={item.label}
      >
        <MaterialIcon icon={item.icon} />
      </Link>
    );
  };

  return (
    <div className="p-1 px-12 flex flex-row items-center justify-between border-b border-app-border bg-app-bg">
      {navigationItems.map(getItemContent)}
    </div>
  );
};

export default HeaderNavigationBar;
