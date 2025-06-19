// frontend/src/components/PromptConfiguration/ServicePromptSection.tsx
import React, { useState } from 'react';
import { updateModule } from '../../services/promptPresetApi';
import type { PromptModule } from '../../services/promptPresetApi';

interface ServicePromptSectionProps {
  serviceName: string;
  serviceIcon: string;
  modules: PromptModule[];
  onModuleToggle: (moduleId: string, enabled: boolean) => void;
  onModuleEdit?: (moduleId: string) => void;
  onModuleDelete?: (moduleId: string) => void;
  isExpanded: boolean;
  onToggleExpanded: () => void;
}

const ServicePromptSection: React.FC<ServicePromptSectionProps> = ({
  serviceName,
  serviceIcon,
  modules,
  onModuleToggle,
  onModuleEdit,
  onModuleDelete,
  isExpanded,
  onToggleExpanded
}) => {  const [fullscreenModule, setFullscreenModule] = useState<PromptModule | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [editingModuleName, setEditingModuleName] = useState<string>('');
  const [editingModuleContent, setEditingModuleContent] = useState<string>('');

  const truncateModuleName = (name: string, maxLength: number = 22): string => {
    if (name.length <= maxLength) return name;
    return name.substring(0, maxLength - 3) + '...';
  };
  const handleModuleContentUpdate = async (newName: string, newContent: string) => {
    if (!fullscreenModule || isUpdating) return;
    
    setIsUpdating(true);
    try {
      await updateModule(fullscreenModule.preset_id, fullscreenModule.id, {
        name: newName,
        content: newContent
      });
      // Update the local module data
      if (onModuleEdit) {
        onModuleEdit(fullscreenModule.id);
      }
      setFullscreenModule(null);
    } catch (error) {
      console.error('Failed to update module:', error);
      // Keep the modal open on error
    } finally {
      setIsUpdating(false);
    }
  };

  const handleOpenModuleEdit = (module: PromptModule) => {
    setFullscreenModule(module);
    setEditingModuleName(module.name);
    setEditingModuleContent(module.content);
  };

  const getServiceColor = (serviceName: string) => {
    const colors: Record<string, string> = {
      Generation: 'text-blue-400',
      Analysis: 'text-green-400',
      Maintenance: 'text-orange-400',
      Embedding: 'text-purple-400'
    };
    return colors[serviceName] || 'text-gray-400';
  };

  const getServiceBgColor = (serviceName: string) => {
    const colors: Record<string, string> = {
      Generation: 'bg-blue-500/10 border-blue-500/30',
      Analysis: 'bg-green-500/10 border-green-500/30',
      Maintenance: 'bg-orange-500/10 border-orange-500/30',
      Embedding: 'bg-purple-500/10 border-purple-500/30'
    };
    return colors[serviceName] || 'bg-gray-500/10 border-gray-500/30';
  };

  const enabledModules = modules.filter(m => m.enabled);
  const totalModules = modules.length;

  return (
    <div className={`border rounded-lg transition-all duration-200 ${getServiceBgColor(serviceName)}`}>
      {/* Service Header */}
      <div 
        className="flex items-center justify-between p-3 cursor-pointer hover:bg-black/20 transition-colors"
        onClick={onToggleExpanded}
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">{serviceIcon}</span>
          <div>
            <h3 className={`font-semibold ${getServiceColor(serviceName)}`}>
              {serviceName} Service
            </h3>
            <p className="text-xs text-app-text-secondary">
              {enabledModules.length}/{totalModules} modules active
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Status indicator */}
          <div className={`w-2 h-2 rounded-full ${
            enabledModules.length > 0 ? getServiceColor(serviceName).replace('text-', 'bg-') : 'bg-gray-500'
          }`} />
          
          {/* Expand/collapse icon */}
          <span className="material-icons-outlined text-sm transition-transform duration-200" style={{
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
          }}>
            expand_more
          </span>
        </div>
      </div>

      {/* Module List */}
      {isExpanded && (
        <div className="border-t border-app-border bg-app-surface/50">
          {modules.length === 0 ? (
            <div className="p-4 text-center text-app-text-secondary">
              <span className="material-icons-outlined text-2xl mb-2 block opacity-50">
                library_books
              </span>
              No modules configured for this service
            </div>
          ) : (            <div className="p-2 space-y-2">
              {modules.map(module => (
                <div
                  key={module.id}
                  className="bg-app-surface border border-app-border rounded-md p-3 flex items-center justify-between"
                >                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Module name - truncated for display */}
                    <span className={`text-sm truncate ${
                      module.enabled ? 'text-app-text' : 'text-app-text-secondary'
                    }`} title={module.name}>
                      {truncateModuleName(module.name)}
                    </span>
                  </div>
                    {/* Right side icons */}
                  <div className="flex items-center gap-2 flex-shrink-0">                    {/* Edit Icon */}
                    <button
                      onClick={() => handleOpenModuleEdit(module)}
                      className="text-app-text-2 hover:text-app-text transition-colors p-1"
                      title="Edit module"
                    >
                      <span className="material-icons-outlined text-sm">edit</span>
                    </button>
                      {/* Delete Icon - now available for all modules */}
                    <button
                      onClick={() => onModuleDelete?.(module.id)}
                      className="text-red-400 hover:text-red-300 transition-colors p-1"
                      title="Delete module"
                    >
                      <span className="material-icons-outlined text-sm">delete</span>
                    </button>
                    
                    {/* Toggle Switch */}
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input                        type="checkbox"
                        checked={module.enabled}
                        onChange={(e) => onModuleToggle(module.id, e.target.checked)}
                        className="sr-only"
                      />                      <div className={`w-8 h-4 rounded-full transition-colors ${
                        module.enabled ? 'bg-blue-600' : 'bg-gray-600'
                      }`}>
                        <div className={`w-3 h-3 bg-white rounded-full transition-transform transform ${
                          module.enabled ? 'translate-x-4 translate-y-0.5' : 'translate-x-0.5 translate-y-0.5'
                        }`} />
                      </div>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}        </div>
      )}        {/* Custom Fullscreen Modal for editing module name and content */}
      {fullscreenModule && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-app-surface rounded-lg shadow-xl w-11/12 h-5/6 max-w-4xl flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-app-border">
              <h3 className="text-lg font-semibold">Edit Module</h3>
              <button
                onClick={() => setFullscreenModule(null)}
                className="text-app-text-2 hover:text-app-text transition-colors p-1"
                disabled={isUpdating}
              >
                <span className="material-icons-outlined">close</span>
              </button>
            </div>
            <div className="flex-1 p-4 flex flex-col gap-4">
              {/* Module Name */}
              <div>
                <label className="block text-sm font-medium text-app-text-2 mb-2">
                  Module Name
                </label>
                <textarea
                  className="w-full p-3 rounded bg-app-bg border-2 border-app-border focus:outline-none focus:border-app-text focus:ring-0 resize-none"
                  value={editingModuleName}
                  onChange={(e) => setEditingModuleName(e.target.value)}
                  placeholder="Enter module name..."
                  disabled={isUpdating}
                  rows={2}
                />
              </div>
              
              {/* Module Content */}
              <div className="flex-1 flex flex-col">
                <label className="block text-sm font-medium text-app-text-2 mb-2">
                  Module Content
                </label>
                <textarea
                  className="w-full flex-1 p-4 rounded bg-app-bg border-2 border-app-border focus:outline-none focus:border-app-text focus:ring-0 resize-none scrollbar-thin scrollbar-track-app-bg scrollbar-thumb-app-border"
                  value={editingModuleContent}
                  onChange={(e) => setEditingModuleContent(e.target.value)}
                  placeholder="Enter module content..."
                  disabled={isUpdating}
                />
              </div>
              
              {/* Save Button */}
              <div className="flex justify-end">
                <button
                  onClick={() => handleModuleContentUpdate(editingModuleName, editingModuleContent)}
                  disabled={isUpdating}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md transition-colors"
                >
                  {isUpdating ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServicePromptSection;
