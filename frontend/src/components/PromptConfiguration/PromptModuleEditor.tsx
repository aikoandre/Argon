// frontend/src/components/PromptConfiguration/PromptModuleEditor.tsx
import React, { useState } from 'react';

interface PromptModule {
  id: string;
  identifier: string;
  name: string;
  category: 'core' | 'style' | 'stance' | 'utility';
  content: string;
  enabled: boolean;
  applicable_services: string[];
}

interface PromptModuleEditorProps {
  module: PromptModule;
  onSave: (updatedModule: PromptModule) => void;
  onCancel: () => void;
  isOpen: boolean;
}

const PromptModuleEditor: React.FC<PromptModuleEditorProps> = ({
  module,
  onSave,
  onCancel,
  isOpen
}) => {
  const [editedModule, setEditedModule] = useState<PromptModule>(module);
  const [previewMode, setPreviewMode] = useState(false);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(editedModule);
  };

  const getServiceBadgeColor = (service: string) => {
    const colors = {
      generation: 'bg-blue-500',
      analysis: 'bg-green-500', 
      maintenance: 'bg-orange-500',
      query_transformation: 'bg-purple-500'
    };
    return colors[service] || 'bg-gray-500';
  };

  const getServiceIcon = (service: string) => {
    const icons = {
      generation: '🎭',
      analysis: '🧠',
      maintenance: '🔧', 
      query_transformation: '🔍'
    };
    return icons[service] || '⚙️';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-app-surface border border-app-border rounded-lg w-full max-w-4xl h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-app-border">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-app-text">
              Edit Prompt Module
            </h3>
            <span className="text-sm text-app-text-secondary">
              {editedModule.identifier}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPreviewMode(!previewMode)}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                previewMode 
                  ? 'bg-app-primary text-app-text' 
                  : 'bg-app-border text-app-text hover:bg-app-text-secondary'
              }`}
            >
              {previewMode ? 'Edit' : 'Preview'}
            </button>
            
            <button
              onClick={onCancel}
              className="text-app-text-secondary hover:text-app-text p-2"
            >
              <span className="material-icons-outlined">close</span>
            </button>
          </div>
        </div>

        {/* Module Info */}
        <div className="p-4 border-b border-app-border bg-app-bg">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-app-text-2 mb-1">
                Module Name
              </label>
              <input
                type="text"
                value={editedModule.name}
                onChange={(e) => setEditedModule({
                  ...editedModule,
                  name: e.target.value
                })}
                className="w-full p-2 bg-app-surface border border-app-border rounded text-app-text"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-app-text-2 mb-1">
                Category
              </label>
              <select
                value={editedModule.category}
                onChange={(e) => setEditedModule({
                  ...editedModule,
                  category: e.target.value as any
                })}
                className="w-full p-2 bg-app-surface border border-app-border rounded text-app-text"
              >
                <option value="core">📜 Core System</option>
                <option value="style">🎨 Writing Style</option>
                <option value="stance">✨ Character Stance</option>
                <option value="utility">🔧 Utility Features</option>
              </select>
            </div>
          </div>
          
          {/* Service Applicability */}
          <div className="mt-4">
            <label className="block text-sm font-medium text-app-text-2 mb-2">
              Applies to Services
            </label>
            <div className="flex flex-wrap gap-2">
              {['generation', 'analysis', 'maintenance', 'query_transformation'].map(service => (
                <label key={service} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editedModule.applicable_services.includes(service)}
                    onChange={(e) => {
                      const newServices = e.target.checked
                        ? [...editedModule.applicable_services, service]
                        : editedModule.applicable_services.filter(s => s !== service);
                      setEditedModule({
                        ...editedModule,
                        applicable_services: newServices
                      });
                    }}
                    className="sr-only"
                  />
                  <div className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                    editedModule.applicable_services.includes(service)
                      ? `${getServiceBadgeColor(service)} text-white`
                      : 'bg-gray-600 text-gray-300'
                  }`}>
                    {getServiceIcon(service)} {service.replace('_', ' ')}
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Content Editor */}
        <div className="flex-1 p-4">
          {previewMode ? (
            <div className="h-full">
              <h4 className="text-sm font-medium text-app-text-2 mb-2">Preview</h4>
              <div className="h-full bg-app-bg p-3 rounded border border-app-border overflow-y-auto">
                <div className="whitespace-pre-wrap text-sm text-app-text font-mono">
                  {editedModule.content}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-sm font-medium text-app-text-2">Prompt Content</h4>
                <div className="text-xs text-app-text-secondary">
                  Supports SillyTavern variables: {'{'}{'{'}{'}char{'}{'}'}, {'{'}{'{'}{'}user{'}{'}'}, {'{'}{'{'}{'}scenario{'}{'}'}}
                </div>
              </div>
              
              <textarea
                value={editedModule.content}
                onChange={(e) => setEditedModule({
                  ...editedModule,
                  content: e.target.value
                })}
                className="flex-1 p-3 bg-app-bg border border-app-border rounded text-sm text-app-text font-mono resize-none focus:outline-none focus:border-blue-500"
                placeholder="Enter your prompt content here..."
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-app-border">
          <div className="text-sm text-app-text-secondary">
            Changes will be saved to your preset and can be exported to SillyTavern format
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm text-app-text hover:text-app-text-2 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-app-primary hover:bg-blue-700 text-white text-sm rounded transition-colors"
            >
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PromptModuleEditor;
