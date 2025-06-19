// frontend/src/components/PromptConfiguration/PromptModuleList.tsx
import React, { useState } from 'react';

type CategoryType = 'core' | 'style' | 'stance' | 'utility';

interface PromptModule {
  id: string;
  identifier: string;
  name: string;
  category: CategoryType;
  content: string;
  enabled: boolean;
  injection_order?: number; // Made optional to match API
}

interface PromptModuleListProps {
  modules: PromptModule[];
  onModuleToggle: (moduleId: string, enabled: boolean) => void;
  onModuleEdit?: (moduleId: string, content: string) => void;
}

const PromptModuleList: React.FC<PromptModuleListProps> = ({
  modules,
  onModuleToggle,
  onModuleEdit
}) => {
  const [expandedModule, setExpandedModule] = useState<string | null>(null);
  
  const categoryOrder: CategoryType[] = ['core', 'style', 'stance', 'utility'];
  const categoryIcons: Record<CategoryType, string> = {
    core: '📜',
    style: '🎨', 
    stance: '✨',
    utility: '🔧'
  };
  
  const categoryNames: Record<CategoryType, string> = {
    core: 'Core System',
    style: 'Writing Style',
    stance: 'Character Stance', 
    utility: 'Utility Features'
  };
  
  const groupedModules = categoryOrder.reduce((acc, category) => {
    acc[category] = modules
      .filter(m => m.category === category)
      .sort((a, b) => (a.injection_order || 0) - (b.injection_order || 0));
    return acc;
  }, {} as Record<CategoryType, PromptModule[]>);

  return (
    <div className="space-y-4">
      {categoryOrder.map(category => {
        const categoryModules = groupedModules[category];
        if (!categoryModules || categoryModules.length === 0) return null;
        
        return (
          <div key={category} className="space-y-2">
            <h4 className="text-sm font-semibold text-app-text-2 flex items-center gap-2">
              <span>{categoryIcons[category]}</span>
              {categoryNames[category]}
              <span className="text-xs text-app-text-secondary">
                ({categoryModules.filter(m => m.enabled).length}/{categoryModules.length})
              </span>
            </h4>
            
            <div className="space-y-1">
              {categoryModules.map(module => (
                <div
                  key={module.id}
                  className="bg-app-surface border border-app-border rounded-md p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={module.enabled}
                          onChange={(e) => onModuleToggle(module.id, e.target.checked)}
                          className="sr-only"
                        />
                        <div className={`w-9 h-5 rounded-full transition-colors ${
                          module.enabled ? 'bg-blue-600' : 'bg-gray-600'
                        }`}>
                          <div className={`w-3 h-3 bg-white rounded-full transition-transform transform ${
                            module.enabled ? 'translate-x-5 translate-y-1' : 'translate-x-1 translate-y-1'
                          }`} />
                        </div>
                      </label>
                      
                      <span className={`text-sm truncate ${
                        module.enabled ? 'text-app-text' : 'text-app-text-secondary'
                      }`}>
                        {module.name}
                      </span>
                    </div>
                    
                    <button
                      onClick={() => setExpandedModule(
                        expandedModule === module.id ? null : module.id
                      )}
                      className="text-app-text-secondary hover:text-app-text transition-colors p-1"
                    >
                      <span className="material-icons-outlined text-sm">
                        {expandedModule === module.id ? 'expand_less' : 'expand_more'}
                      </span>
                    </button>
                  </div>
                  
                  {expandedModule === module.id && (
                    <div className="mt-3 pt-3 border-t border-app-border">
                      <div className="text-xs text-app-text-secondary mb-2">
                        Prompt Content:
                      </div>
                      <div className="bg-app-bg p-2 rounded text-xs text-app-text font-mono max-h-32 overflow-y-auto scrollbar-thin scrollbar-track-app-bg scrollbar-thumb-app-border">
                        {module.content}
                      </div>
                      {onModuleEdit && (
                        <button
                          onClick={() => {/* TODO: Open edit modal */}}
                          className="mt-2 text-xs text-blue-400 hover:text-blue-300"
                        >
                          Edit Content
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PromptModuleList;
