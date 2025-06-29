// frontend/src/components/Layout/EnhancedLeftPanel.tsx
import React, { useState, useEffect } from 'react';
import ServicePromptSection from '../PromptConfiguration/ServicePromptSection';
import { getUserSettings } from '../../services/api';
import { useActiveCard } from '../../contexts/ActiveCardContext';
import { 
  getAllPresets, 
  getPresetById,
  createPreset,
  updatePreset,
  deletePreset,
  getUserPromptConfiguration, 
  updateUserPromptConfiguration,
  toggleModule,
  createModule,
  deleteModule,
  getContextRecommendations,
  createDefaultNemoPreset,
  type PromptPreset as APIPromptPreset,
  type UserPromptConfiguration as APIUserPromptConfiguration,
  type PromptModule
} from '../../services/promptPresetApi';

interface RuntimeParameters {
  temperature: number;
  topP: number;
  topK?: number;
  topA?: number;
  minP?: number;
  maxTokens?: number;
  frequencyPenalty: number;
  presencePenalty: number;
  repetitionPenalty: number;
  reasoningEffort: string;
  contextSize: number;
}

interface EnhancedLeftPanelProps {
  // Props removed - component is now fully self-contained
}

const EnhancedLeftPanel: React.FC<EnhancedLeftPanelProps> = () => {
  const { activeCard } = useActiveCard();  const [parameters, setParameters] = useState<RuntimeParameters>({
    temperature: 0.3,
    topP: 0.95,
    topK: 40,
    topA: 1,
    minP: 0,
    maxTokens: 8164,
    frequencyPenalty: 0,
    presencePenalty: 0,
    repetitionPenalty: 1,
    reasoningEffort: 'Max',
    contextSize: 50
  });const [selectedPreset, setSelectedPreset] = useState<string>('');
  const [availablePresets, setAvailablePresets] = useState<APIPromptPreset[]>([]);
  const [userConfiguration, setUserConfiguration] = useState<APIUserPromptConfiguration | null>(null);
  const [promptModules, setPromptModules] = useState<PromptModule[]>([]);
    // Service-specific states for 4-drawer UI
  const [expandedServices, setExpandedServices] = useState<Record<string, boolean>>({
    Generation: true,   // Start with Generation expanded
    Analysis: false,
    Maintenance: false,
    Embedding: false
  });

  const [showCreateModuleModal, setShowCreateModuleModal] = useState(false);
  const [newModuleName, setNewModuleName] = useState('');
  const [newModuleContent, setNewModuleContent] = useState('');
  const [newModuleServices, setNewModuleServices] = useState<string[]>(['generation']);
  const [isCreatingModule, setIsCreatingModule] = useState(false);

  const [contextRecommendations, setContextRecommendations] = useState<{
    recommended: number;
    max_possible: number;
    provider_info?: string;
  } | null>(null);
  // Load user settings and context recommendations on mount
  useEffect(() => {    const loadSettings = async () => {
      try {
        console.log('🔄 Loading presets...');
        
        // Add timeout to getAllPresets call
        const presetsPromise = getAllPresets();
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Preset loading timeout')), 5000)
        );        let presets: APIPromptPreset[];
        try {
          presets = await Promise.race([presetsPromise, timeoutPromise]) as APIPromptPreset[];
          console.log('📋 All presets loaded:', presets);
          console.log('📋 Preset names:', presets.map(p => p.name));
        } catch (error) {
          console.error('❌ Failed to load presets:', error);
          presets = [];
        }
        
        if (presets.length === 0) {
          console.log('📋 No presets found, creating default...');
          try {
            await createDefaultNemoPreset();
            presets = await getAllPresets();
            console.log('📋 Presets after creating default:', presets);
          } catch (error) {
            console.error('❌ Failed to create default preset:', error);
            presets = []; // Ensure presets is empty on failure
          }
        }

        // Filter to show only NemoEngine Argon Edition
        const filteredPresets = presets.filter(p => p.name === 'NemoEngine Argon Edition');
        console.log('🔍 Filtered presets (Argon Edition only):', filteredPresets);
        
        // If no Argon Edition found, show all presets temporarily
        if (filteredPresets.length === 0) {
          console.log('⚠️ No Argon Edition preset found, showing all presets');
          setAvailablePresets(presets);
        } else {
          setAvailablePresets(filteredPresets);
        }
          const userConfig = await getUserPromptConfiguration();
        let activePresetId = userConfig.active_preset_id;
        
        const actualPresets = filteredPresets.length > 0 ? filteredPresets : presets;
        const isPresetAvailable = actualPresets.some(p => p.id === activePresetId);
        
        if (!activePresetId || !isPresetAvailable) {
            const defaultPreset = actualPresets.find(p => p.is_default) || (actualPresets.length > 0 ? actualPresets[0] : null);
            activePresetId = defaultPreset ? defaultPreset.id : undefined;
        }
        
        if (activePresetId && activePresetId !== userConfig.active_preset_id) {
          await updateUserPromptConfiguration({ active_preset_id: activePresetId });
          userConfig.active_preset_id = activePresetId;
        }
        
        setUserConfiguration(userConfig);
        
        if (activePresetId) {
          setSelectedPreset(activePresetId);
          try {
            const presetWithModules = await getPresetById(activePresetId);
            setPromptModules(presetWithModules.modules || []);
          } catch (error) {
            console.error(`Failed to load modules for preset ${activePresetId}:`, error);
            setPromptModules([]);
          }
        } else {
          setSelectedPreset('');
          setPromptModules([]);
        }
          // Load parameters from user configuration
        setParameters(prev => ({
          ...prev,
          contextSize: userConfig.context_size || 50,
          maxTokens: userConfig.max_tokens || 8164,
          temperature: userConfig.temperature || 0.3,
          topP: userConfig.top_p || 0.95,
          reasoningEffort: userConfig.reasoning_effort || 'Max',
          topK: userConfig.top_k || 40,
          topA: userConfig.top_a || 1,
          minP: userConfig.min_p || 0,
          frequencyPenalty: userConfig.frequency_penalty || 0,
          presencePenalty: userConfig.presence_penalty || 0,
          repetitionPenalty: userConfig.repetition_penalty || 1,
        }));

        // Get context recommendations for current model if available
        const settings = await getUserSettings();
        if (settings?.primary_llm_model) {
          try {
            const recommendations = await getContextRecommendations(settings.primary_llm_model);
            setContextRecommendations(recommendations);
          } catch (error) {
            console.log('Context recommendations not available:', error);
          }
        }
      } catch (error) {
        console.error('Failed to load prompt system settings:', error);
        
        // Fallback: Load basic user settings
        try {
          const settings = await getUserSettings();
          if (settings) {
            setParameters(prev => ({
              ...prev,
              contextSize: settings.max_messages_for_context || 20,
              maxTokens: settings.max_response_tokens || undefined,
              temperature: settings.primary_llm_temperature || 1.0,
              topP: settings.primary_llm_top_p || 1.0,
            }));
          }
        } catch (fallbackError) {
          console.error('Failed to load fallback settings:', error);
        }
      }
    };

    loadSettings();
  }, []);  const handleParameterChange = async (field: keyof RuntimeParameters, value: any) => {
    setParameters(prev => ({
      ...prev,
      [field]: value
    }));
    
    // For context size, validate against model capabilities
    if (field === 'contextSize' && contextRecommendations) {
      if (value > contextRecommendations.max_possible) {
        console.warn(`Context size ${value} exceeds maximum ${contextRecommendations.max_possible} for current model`);
        // Could show a warning to user here
      }
    }
    
    // Auto-save to user prompt configuration
    try {
      const updateData: Partial<APIUserPromptConfiguration> = {};
      
      // Map frontend parameters to backend prompt configuration fields
      switch (field) {
        case 'contextSize':
          updateData.context_size = value;
          break;
        case 'maxTokens':
          updateData.max_tokens = value;
          break;
        case 'temperature':
          updateData.temperature = value;
          break;
        case 'topP':
          updateData.top_p = value;
          break;
        case 'topK':
          updateData.top_k = value;
          break;
        case 'topA':
          updateData.top_a = value;
          break;
        case 'minP':
          updateData.min_p = value;
          break;
        case 'frequencyPenalty':
          updateData.frequency_penalty = value;
          break;
        case 'presencePenalty':
          updateData.presence_penalty = value;
          break;
        case 'repetitionPenalty':
          updateData.repetition_penalty = value;
          break;
        case 'reasoningEffort':
          updateData.reasoning_effort = value;
          break;
        default:
          console.log(`Parameter ${field} not mapped yet`);
          return;
      }
      
      // Update user prompt configuration
      const updatedConfig = await updateUserPromptConfiguration(updateData);
      setUserConfiguration(updatedConfig);
      
      console.log(`Auto-saved ${field} to prompt configuration:`, value);
    } catch (error) {
      console.error('Failed to auto-save parameter:', error);
    }
  };  const handleModuleToggle = async (moduleId: string, enabled: boolean) => {
    // Update local state immediately for responsiveness
    setPromptModules(prev => 
      prev.map(module => 
        module.id === moduleId ? { ...module, enabled } : module
      )
    );
    
    // Save to backend
    try {
      if (userConfiguration?.active_preset_id) {
        await toggleModule(userConfiguration.active_preset_id, moduleId, enabled);
        console.log(`Module ${moduleId} toggled to ${enabled}`);
      }
    } catch (error) {
      console.error('Failed to toggle module:', error);
      // Revert local state on error
      setPromptModules(prev => 
        prev.map(module => 
          module.id === moduleId ? { ...module, enabled: !enabled } : module
        )
      );
    }
  };

  const handleModuleEdit = async (moduleId: string) => {
    // Refresh modules after editing to get updated content
    try {
      if (userConfiguration?.active_preset_id) {
        const presetWithModules = await getPresetById(userConfiguration.active_preset_id);
        setPromptModules(presetWithModules.modules || []);
        console.log(`Module ${moduleId} updated, refreshed modules`);
      }
    } catch (error) {
      console.error('Failed to refresh modules after edit:', error);
    }
  };  const handleCreateModule = async () => {
    // Open the create module modal
    setNewModuleName('New Module');
    setNewModuleContent('Enter your module content here...');
    setNewModuleServices(['generation']);
    setShowCreateModuleModal(true);
  };

  const handleCreateModuleSubmit = async () => {
    try {
      if (!userConfiguration?.active_preset_id) {
        console.error('No active preset selected');
        return;
      }

      setIsCreatingModule(true);

      // Create a new module with values from the modal
      const newModule = {
        identifier: `custom_module_${Date.now()}`,
        name: newModuleName,
        category: 'utility' as const,
        content: newModuleContent,
        enabled: true,
        injection_position: 'after',
        injection_depth: 1,
        injection_order: 1000,
        forbid_overrides: false,
        role: 'user',
        applicable_services: newModuleServices,
        is_core_module: false,
        service_priority: 100
      };

      const createdModule = await createModule(userConfiguration.active_preset_id, newModule);
      
      // Refresh modules to include the new one
      const presetWithModules = await getPresetById(userConfiguration.active_preset_id);
      setPromptModules(presetWithModules.modules || []);
      
      // Close modal and reset form
      setShowCreateModuleModal(false);
      setNewModuleName('');
      setNewModuleContent('');
      setNewModuleServices(['generation']);
      
      console.log('✅ Module created successfully:', createdModule.id);
    } catch (error) {
      console.error('❌ Failed to create module:', error);
    } finally {
      setIsCreatingModule(false);
    }
  };

  const handleServiceToggleForNewModule = (serviceName: string) => {
    const serviceKey = serviceName.toLowerCase();
    setNewModuleServices(prev => {
      if (prev.includes(serviceKey)) {
        // Remove service if already selected (but keep at least one)
        return prev.length > 1 ? prev.filter(s => s !== serviceKey) : prev;
      } else {
        // Add service if not selected
        return [...prev, serviceKey];
      }
    });
  };

  const handleDeleteModule = async (moduleId: string) => {
    try {
      if (!userConfiguration?.active_preset_id) {
        console.error('No active preset selected');
        return;
      }

      // Remove from local state immediately for responsiveness
      setPromptModules(prev => prev.filter(module => module.id !== moduleId));

      // Delete from backend
      await deleteModule(userConfiguration.active_preset_id, moduleId);
      
      console.log('✅ Module deleted successfully:', moduleId);
    } catch (error) {
      console.error('❌ Failed to delete module:', error);
      
      // Refresh modules on error to restore correct state
      if (userConfiguration?.active_preset_id) {
        try {
          const presetWithModules = await getPresetById(userConfiguration.active_preset_id);
          setPromptModules(presetWithModules.modules || []);
        } catch (refreshError) {
          console.error('Failed to refresh modules after delete error:', refreshError);
        }
      }
    }
  };

  const handlePresetChange = async (presetId: string) => {
    setSelectedPreset(presetId);
    setPromptModules([]); // Clear modules while loading
    
    try {
      // Update user configuration with new active preset
      const updateData: Partial<APIUserPromptConfiguration> = {
        active_preset_id: presetId
      };
      
      const updatedConfig = await updateUserPromptConfiguration(updateData);
      setUserConfiguration(updatedConfig);
      
      // Load modules for the new preset
      console.log(`Loading modules for preset: ${presetId}`);      const presetWithModules = await getPresetById(presetId);
      console.log(`Loaded ${presetWithModules.modules?.length || 0} modules for preset ${presetId}`);
      setPromptModules(presetWithModules.modules || []);
      
      console.log(`Switched to preset: ${presetId}`);
    } catch (error) {
      console.error('Failed to change preset:', error);
      // Revert on error
      setSelectedPreset(userConfiguration?.active_preset_id || '');    }
  };
  
  const handleSavePreset = async () => {
    try {
      // Save current parameters to user configuration
      await updateUserPromptConfiguration({
        temperature: parameters.temperature,
        top_p: parameters.topP,
        top_k: parameters.topK,
        top_a: parameters.topA,
        min_p: parameters.minP,
        max_tokens: parameters.maxTokens,
        frequency_penalty: parameters.frequencyPenalty,
        presence_penalty: parameters.presencePenalty,
        repetition_penalty: parameters.repetitionPenalty,
        reasoning_effort: parameters.reasoningEffort,
        context_size: parameters.contextSize
      });
      
      console.log('✅ Preset saved successfully: parameters and module states updated');
      // TODO: Add toast notification for user feedback
    } catch (error) {
      console.error('❌ Failed to save preset:', error);
      // TODO: Add error toast notification
    }
  };
  const handleImportPreset = async () => {
    try {
      // Create file input element for JSON import
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json';
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        
        try {
          const text = await file.text();
          const presetData = JSON.parse(text);
          
          // Validate preset structure
          if (!presetData.name) {
            throw new Error('Invalid preset format: missing name');
          }
          
          // Create new preset using API
          const newPreset = await createPreset({
            name: presetData.name,
            description: presetData.description || `Imported from ${file.name}`,
            is_sillytavern_compatible: false
          });
          
          // Refresh presets list
          const updatedPresets = await getAllPresets();
          setAvailablePresets(updatedPresets);
          
          // Switch to new preset
          await handlePresetChange(newPreset.id);
          
          console.log('📥 Preset imported successfully:', newPreset.name);
          
        } catch (error) {
          console.error('❌ Failed to import preset:', error);
          alert(`Failed to import preset: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      };
      input.click();
    } catch (error) {
      console.error('❌ Failed to initiate import:', error);
    }
  };

  const handleExportPreset = async () => {
    try {
      if (!userConfiguration?.active_preset_id) {
        console.error('No active preset to export');
        return;
      }

      // Get current preset with modules
      const preset = await getPresetById(userConfiguration.active_preset_id);
      
      // Create export data
      const exportData = {
        name: preset.name,
        description: preset.description || '',
        modules: preset.modules || [],
        parameters: {
          temperature: parameters.temperature,
          top_p: parameters.topP,
          top_k: parameters.topK,
          top_a: parameters.topA,
          min_p: parameters.minP,
          max_tokens: parameters.maxTokens,
          frequency_penalty: parameters.frequencyPenalty,
          presence_penalty: parameters.presencePenalty,
          repetition_penalty: parameters.repetitionPenalty,
          reasoning_effort: parameters.reasoningEffort,
          context_size: parameters.contextSize
        },
        exported_at: new Date().toISOString()
      };

      // Download as JSON file
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${preset.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_preset.json`;
      a.click();
      URL.revokeObjectURL(url);
      
      console.log('📤 Preset exported successfully:', preset.name);
    } catch (error) {
      console.error('❌ Failed to export preset:', error);
    }
  };
  const handleRenamePreset = async () => {
    try {
      if (!userConfiguration?.active_preset_id) {
        console.error('No active preset to rename');
        return;
      }

      const currentPreset = availablePresets.find(p => p.id === userConfiguration.active_preset_id);
      const newName = prompt('Enter new preset name:', currentPreset?.name || '');
      
      if (!newName || newName.trim() === '') return;
      if (newName === currentPreset?.name) return;

      // Update preset name using API
      await updatePreset(userConfiguration.active_preset_id, { name: newName.trim() });
      
      // Refresh presets list
      const updatedPresets = await getAllPresets();
      setAvailablePresets(updatedPresets);
      
      console.log('✏️ Preset renamed successfully to:', newName);
      
    } catch (error) {
      console.error('❌ Failed to rename preset:', error);
      alert(`Failed to rename preset: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };
  const handleDeletePreset = async () => {
    try {
      if (!userConfiguration?.active_preset_id) {
        console.error('No active preset to delete');
        return;
      }      const currentPreset = availablePresets.find(p => p.id === userConfiguration.active_preset_id);
      
      const confirmed = confirm(`Are you sure you want to delete the preset "${currentPreset?.name}"? This action cannot be undone.`);
      if (!confirmed) return;

      // Delete preset using API
      await deletePreset(userConfiguration.active_preset_id);
      
      // Refresh presets list
      const updatedPresets = await getAllPresets();
      setAvailablePresets(updatedPresets);
      
      // Switch to another preset if available, otherwise clear selection
      if (updatedPresets.length > 0) {
        // Try to find default preset first, otherwise use the first available
        const nextPreset = updatedPresets.find(p => p.is_default) || updatedPresets[0];
        await handlePresetChange(nextPreset.id);
      } else {
        // No presets left, clear selection
        setSelectedPreset('');
        setPromptModules([]);
        // Optionally create a new default preset
        try {
          const newDefaultPreset = await createDefaultNemoPreset();
          const refreshedPresets = await getAllPresets();
          setAvailablePresets(refreshedPresets);
          await handlePresetChange(newDefaultPreset.id);
        } catch (createError) {
          console.error('Failed to create new default preset:', createError);
        }
      }
      
      console.log('🗑️ Preset deleted successfully:', currentPreset?.name);
      
    } catch (error) {
      console.error('❌ Failed to delete preset:', error);
      alert(`Failed to delete preset: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Helper function to group modules by applicable services
  const getModulesByService = (serviceName: string): PromptModule[] => {
    return promptModules.filter(module => {
      // Parse applicable_services if it's a JSON string
      let applicableServices: string[] = [];
      
      if (module.applicable_services) {
        if (Array.isArray(module.applicable_services)) {
          applicableServices = module.applicable_services;
        } else if (typeof module.applicable_services === 'string') {
          try {
            applicableServices = JSON.parse(module.applicable_services);
          } catch {
            applicableServices = [module.applicable_services];
          }
        }
      }
      
      // Check if this module applies to the requested service
      return applicableServices.includes(serviceName.toLowerCase());
    });
  };

  const handleServiceToggle = (serviceName: string) => {
    setExpandedServices(prev => ({
      ...prev,
      [serviceName]: !prev[serviceName]
    }));  };

  return (
    <div className="h-full flex flex-col bg-app-bg overflow-y-auto">
      {/* Section 1: Runtime Parameters */}
      <div className="border-b border-app-border p-4 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-app-text flex items-center gap-2">
            <span className="material-icons-outlined text-xl">tune</span>
            Parameters
          </h3>            {/* Action buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={handleImportPreset}
              className="p-1.5 bg-app-surface hover:bg-app-border rounded-md transition-colors group"
              title="Import Preset"
            >
              <span className="material-icons-outlined text-sm text-app-text-secondary group-hover:text-app-text">
                file_upload
              </span>
            </button>
            <button
              onClick={handleExportPreset}
              className="p-1.5 bg-app-surface hover:bg-app-border rounded-md transition-colors group"
              title="Export Preset"
            >
              <span className="material-icons-outlined text-sm text-app-text-secondary group-hover:text-app-text">
                file_download
              </span>
            </button>            <button
              onClick={handleSavePreset}
              className="p-1.5 bg-app-surface hover:bg-app-border rounded-md transition-colors group"
              title="Save Current Parameters & Prompts"
            >
              <span className="material-icons-outlined text-sm text-app-text-secondary group-hover:text-app-text">
                save
              </span>
            </button>
            <button
              onClick={handleRenamePreset}
              className="p-1.5 bg-app-surface hover:bg-app-border rounded-md transition-colors group"
              title="Rename Preset"
            >
              <span className="material-icons-outlined text-sm text-app-text-secondary group-hover:text-app-text">
                edit
              </span>
            </button>
            <button
              onClick={handleDeletePreset}
              className="p-1.5 bg-red-600/20 hover:bg-red-600/40 rounded-md transition-colors group"
              title="Delete Preset"
            >
              <span className="material-icons-outlined text-sm text-red-400 group-hover:text-red-300">
                delete
              </span>
            </button>
          </div>
        </div>        {/* Preset Selector */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-app-text-2 mb-1">
            Active Preset
          </label>
          <select
            value={selectedPreset}
            onChange={(e) => handlePresetChange(e.target.value)}
            className="w-full bg-app-surface border border-app-border rounded-md text-white focus:ring-blue-500 focus:border-blue-500 p-1"
          >
            {availablePresets.length === 0 && (
              <option value="">Loading presets...</option>
            )}            {availablePresets.map(preset => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
        </div>
        
        <div className="space-y-3">
          {/* Core Parameters */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-app-text border-b border-app-border/50 pb-1">Core Parameters</h4>
            
            {/* Temperature */}
            <div>
              <label className="block text-sm font-medium text-app-text-2 mb-1">
                Temperature: {parameters.temperature}
              </label>
              <input
                type="range"
                min="0"
                max="2"
                step="0.1"
                value={parameters.temperature}
                onChange={(e) => handleParameterChange('temperature', parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between text-xs text-app-text-secondary mt-1">
                <span>Focused</span>
                <span>Creative</span>
              </div>
            </div>

            {/* Top P */}
            <div>
              <label className="block text-sm font-medium text-app-text-2 mb-1">
                Top P: {parameters.topP}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={parameters.topP}
                onChange={(e) => handleParameterChange('topP', parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between text-xs text-app-text-secondary mt-1">
                <span>Narrow</span>
                <span>Diverse</span>
              </div>
            </div>

            {/* Reasoning Effort */}
            <div>
              <label className="block text-sm font-medium text-app-text-2 mb-1">
                Reasoning Effort
              </label>              <select
                value={parameters.reasoningEffort}
                onChange={(e) => handleParameterChange('reasoningEffort', e.target.value)}
                className="w-full p-2 bg-app-surface border border-app-border rounded-md text-white focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Max">Max</option>
              </select>
            </div>
          </div>

          {/* Advanced Sampling Parameters */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-app-text border-b border-app-border/50 pb-1">Advanced Sampling</h4>
            
            {/* Top K */}
            <div>
              <label className="block text-sm font-medium text-app-text-2 mb-1">
                Top K: {parameters.topK || 'Disabled'}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="1"
                  max="100"
                  step="1"
                  value={parameters.topK || 40}
                  disabled={!parameters.topK}
                  onChange={(e) => handleParameterChange('topK', parseInt(e.target.value))}
                  className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider disabled:opacity-50"
                />
                <input
                  type="checkbox"
                  checked={!!parameters.topK}
                  onChange={(e) => handleParameterChange('topK', e.target.checked ? 40 : undefined)}
                  className="w-4 h-4"
                />
              </div>
            </div>

            {/* Min P */}
            <div>
              <label className="block text-sm font-medium text-app-text-2 mb-1">
                Min P: {parameters.minP?.toFixed(3) || 'Disabled'}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.001"
                  value={parameters.minP || 0.05}
                  disabled={!parameters.minP}
                  onChange={(e) => handleParameterChange('minP', parseFloat(e.target.value))}
                  className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider disabled:opacity-50"
                />
                <input
                  type="checkbox"
                  checked={!!parameters.minP}
                  onChange={(e) => handleParameterChange('minP', e.target.checked ? 0.05 : undefined)}
                  className="w-4 h-4"
                />
              </div>
            </div>

            {/* Top A */}
            <div>
              <label className="block text-sm font-medium text-app-text-2 mb-1">
                Top A: {parameters.topA?.toFixed(3) || 'Disabled'}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.001"
                  value={parameters.topA || 0.2}
                  disabled={!parameters.topA}
                  onChange={(e) => handleParameterChange('topA', parseFloat(e.target.value))}
                  className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider disabled:opacity-50"
                />
                <input
                  type="checkbox"
                  checked={!!parameters.topA}
                  onChange={(e) => handleParameterChange('topA', e.target.checked ? 0.2 : undefined)}
                  className="w-4 h-4"
                />
              </div>
            </div>
          </div>

          {/* Penalty Parameters */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-app-text border-b border-app-border/50 pb-1">Penalty Controls</h4>
            
            {/* Frequency Penalty */}
            <div>
              <label className="block text-sm font-medium text-app-text-2 mb-1">
                Frequency Penalty: {parameters.frequencyPenalty.toFixed(2)}
              </label>
              <input
                type="range"
                min="-2"
                max="2"
                step="0.01"
                value={parameters.frequencyPenalty}
                onChange={(e) => handleParameterChange('frequencyPenalty', parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between text-xs text-app-text-secondary mt-1">
                <span>Encourage</span>
                <span>Discourage</span>
              </div>
            </div>

            {/* Presence Penalty */}
            <div>
              <label className="block text-sm font-medium text-app-text-2 mb-1">
                Presence Penalty: {parameters.presencePenalty.toFixed(2)}
              </label>
              <input
                type="range"
                min="-2"
                max="2"
                step="0.01"
                value={parameters.presencePenalty}
                onChange={(e) => handleParameterChange('presencePenalty', parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between text-xs text-app-text-secondary mt-1">
                <span>Repetition OK</span>
                <span>Avoid Topics</span>
              </div>
            </div>

            {/* Repetition Penalty */}
            <div>
              <label className="block text-sm font-medium text-app-text-2 mb-1">
                Repetition Penalty: {parameters.repetitionPenalty.toFixed(2)}
              </label>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.01"
                value={parameters.repetitionPenalty}
                onChange={(e) => handleParameterChange('repetitionPenalty', parseFloat(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between text-xs text-app-text-secondary mt-1">
                <span>Allow Repeat</span>
                <span>Force Variety</span>
              </div>
            </div>
          </div>          {/* Context & Token Controls */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold text-app-text border-b border-app-border/50 pb-1">Context & Token Limits</h4>            {/* Context Size */}
            <div>
              <label className="block text-sm font-medium text-app-text-2 mb-1">
                Context Size: {parameters.contextSize} messages
                {contextRecommendations && (
                  <span className="text-xs text-app-text-secondary ml-2">
                    (Recommended: {contextRecommendations.recommended}, Max: {contextRecommendations.max_possible})
                  </span>
                )}
              </label>
              <input
                type="range"
                min="5"
                max={contextRecommendations?.max_possible || 100}
                step="5"
                value={parameters.contextSize}
                onChange={(e) => handleParameterChange('contextSize', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
              />
              <div className="flex justify-between text-xs text-app-text-secondary mt-1">
                <span>5 (Short)</span>
                {contextRecommendations && (
                  <span>{contextRecommendations.recommended} (Recommended)</span>
                )}
                <span>50 (Default)</span>
                <span>50 (Long)</span>
                <span>{contextRecommendations?.max_possible || 100} (Max)</span>
              </div>
              <div className="text-xs text-app-text-secondary mt-2 space-y-1">
                <p><strong>Context Memory:</strong> How many recent chat messages the AI can see and remember.</p>
                <p><strong>50 messages</strong> ≈ Last 25 exchanges (recommended for most conversations)</p>
                <p><strong>Higher values</strong> = More context but slower responses and higher cost</p>
                {contextRecommendations?.provider_info && (
                  <p><strong>Model Info:</strong> {contextRecommendations.provider_info}</p>
                )}
              </div>
            </div>

            {/* Token Limit */}
            <div>
              <label className="block text-sm font-medium text-app-text-2 mb-1">
                Max Tokens: {parameters.maxTokens || 'Auto'}
              </label>
              <div className="flex items-center gap-2">
                <textarea
                  value={parameters.maxTokens || ''}
                  disabled={!parameters.maxTokens}
                  onChange={(e) => handleParameterChange('maxTokens', e.target.value ? parseInt(e.target.value, 10) : undefined)}
                  placeholder="Auto"
                  className="flex-1 p-2 bg-app-surface border border-app-border rounded-md text-white focus:ring-blue-500 focus:border-blue-500 resize-none disabled:opacity-50"
                  rows={1}
                />
                <input
                  type="checkbox"
                  checked={!!parameters.maxTokens}
                  onChange={(e) => handleParameterChange('maxTokens', e.target.checked ? 8000 : undefined)}
                  className="w-4 h-4"
                />
              </div>
              <p className="text-xs text-app-text-secondary mt-1">
                Maximum response length. Uncheck for model default.
              </p>
            </div>
          </div>
        </div>
      </div>      {/* Section 2: Service-Specific Prompt Modules (4-Drawer Architecture) */}
      <div className="flex-1 border-b border-app-border">
        <div className="p-4">          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-app-text flex items-center gap-2">
              <span className="material-icons-outlined text-xl">psychology</span>
              AI Modules
            </h3>
            
            {/* Module action buttons */}
            <div className="flex items-center gap-1">              <button
                onClick={handleCreateModule}
                className="p-1.5 bg-green-600/20 hover:bg-green-600/40 rounded-md transition-colors group"
                title="Create New Module"
              >
                <span className="material-icons-outlined text-sm text-green-400 group-hover:text-green-300">
                  add
                </span>
              </button>
            </div>
          </div>
          
          {/* Debug info - remove in production */}
          {promptModules.length === 0 && (
            <div className="mb-3 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded text-yellow-400 text-sm">
              ⚠️ No modules loaded. Selected preset: {selectedPreset || 'None'}
            </div>          )}
            <div className="space-y-3">
            {/* Generation Service */}
            <ServicePromptSection
              serviceName="Generation"
              serviceIcon="🎭"
              modules={getModulesByService('generation')}
              onModuleToggle={handleModuleToggle}
              onModuleEdit={handleModuleEdit}
              onModuleDelete={handleDeleteModule}
              isExpanded={expandedServices.Generation}
              onToggleExpanded={() => handleServiceToggle('Generation')}
            />
            
            {/* Analysis Service */}
            <ServicePromptSection
              serviceName="Analysis"
              serviceIcon="🧠"
              modules={getModulesByService('analysis')}
              onModuleToggle={handleModuleToggle}
              onModuleEdit={handleModuleEdit}
              onModuleDelete={handleDeleteModule}
              isExpanded={expandedServices.Analysis}
              onToggleExpanded={() => handleServiceToggle('Analysis')}
            />
            
            {/* Maintenance Service */}
            <ServicePromptSection
              serviceName="Maintenance"
              serviceIcon="🔧"
              modules={getModulesByService('maintenance')}
              onModuleToggle={handleModuleToggle}
              onModuleEdit={handleModuleEdit}
              onModuleDelete={handleDeleteModule}
              isExpanded={expandedServices.Maintenance}
              onToggleExpanded={() => handleServiceToggle('Maintenance')}
            />
            
            {/* Embedding Service */}
            <ServicePromptSection
              serviceName="Embedding"
              serviceIcon="🔍"
              modules={getModulesByService('embedding')}
              onModuleToggle={handleModuleToggle}
              onModuleEdit={handleModuleEdit}
              onModuleDelete={handleDeleteModule}
              isExpanded={expandedServices.Embedding}
              onToggleExpanded={() => handleServiceToggle('Embedding')}
            />
          </div>
        </div>
      </div>{/* Section 3: Active Card Display */}
      <div className="flex-shrink-0 bg-app-surface" id="active-card-section">
        {activeCard.type && (
          <div className="p-4">
            <h3 className="text-lg font-semibold mb-3 text-app-text flex items-center gap-2">
              <span className="material-icons-outlined text-xl">
                {activeCard.type === 'character' ? 'person' : 
                 activeCard.type === 'scenario' ? 'map' : 'account_circle'}
              </span>
              Active {activeCard.type === 'character' ? 'Character' : 
                      activeCard.type === 'scenario' ? 'Scenario' : 'Persona'}            </h3>
            
            {/* Card container - non-clickable */}
            <div className="rounded-md p-3">
              <div className="space-y-3">
                {activeCard.name && (
                  <div>
                    <h4 className="font-medium text-app-text">{activeCard.name}</h4>
                  </div>
                )}
                  {activeCard.image && (
                  <div className="relative aspect-[3/4.5]">
                    <img
                      src={activeCard.image}
                      alt={activeCard.name || `${activeCard.type} image`}
                      className="w-full h-full object-cover rounded-md"
                    />
                  </div>
                )}
                
                {!activeCard.image && (
                  <div className="w-full aspect-[3/4.5] bg-app-border/50 rounded-md flex items-center justify-center">
                    <span className="material-icons-outlined text-4xl text-app-text-secondary opacity-50">
                      {activeCard.type === 'character' ? 'person' : 
                       activeCard.type === 'scenario' ? 'map' : 'account_circle'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        {!activeCard.type && (
          <div className="p-4 text-center text-app-text-secondary">
            <span className="material-icons-outlined text-4xl mb-2 block opacity-50">
              psychology_alt
            </span>
            <p className="text-sm">
              Select a character, scenario, or persona to begin
            </p>
          </div>        )}
      </div>

      {/* Create Module Modal */}
      {showCreateModuleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-app-surface rounded-lg shadow-xl w-11/12 h-5/6 max-w-4xl flex flex-col">
            <div className="flex justify-between items-center p-4 border-b border-app-border">
              <h3 className="text-lg font-semibold">Create New Module</h3>
              <button
                onClick={() => setShowCreateModuleModal(false)}
                className="text-app-text-2 hover:text-app-text transition-colors p-1"
                disabled={isCreatingModule}
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
                  value={newModuleName}
                  onChange={(e) => setNewModuleName(e.target.value)}
                  placeholder="Enter module name..."
                  disabled={isCreatingModule}
                  rows={2}
                />
              </div>

              {/* Service Selection */}
              <div>
                <label className="block text-sm font-medium text-app-text-2 mb-2">
                  Applicable Services
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {['Generation', 'Analysis', 'Maintenance', 'Embedding'].map(service => (
                    <label key={service} className="flex items-center gap-2 p-2 bg-app-bg rounded border border-app-border cursor-pointer hover:bg-app-border/30">
                      <input
                        type="checkbox"
                        checked={newModuleServices.includes(service.toLowerCase())}
                        onChange={() => handleServiceToggleForNewModule(service)}
                        disabled={isCreatingModule}
                        className="w-4 h-4"
                      />
                      <span className="text-sm">{service}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-app-text-secondary mt-1">
                  Select which services this module applies to (at least one required)
                </p>
              </div>
              
              {/* Module Content */}
              <div className="flex-1 flex flex-col">
                <label className="block text-sm font-medium text-app-text-2 mb-2">
                  Module Content
                </label>
                <textarea
                  className="w-full flex-1 p-4 rounded bg-app-bg border-2 border-app-border focus:outline-none focus:border-app-text focus:ring-0 resize-none scrollbar-thin scrollbar-track-app-bg scrollbar-thumb-app-border"
                  value={newModuleContent}
                  onChange={(e) => setNewModuleContent(e.target.value)}
                  placeholder="Enter module content..."
                  disabled={isCreatingModule}
                />
              </div>
              
              {/* Action Buttons */}
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowCreateModuleModal(false)}
                  disabled={isCreatingModule}
                  className="px-4 py-2 bg-app-surface hover:bg-app-bg disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateModuleSubmit}
                  disabled={isCreatingModule || !newModuleName.trim() || !newModuleContent.trim()}
                  className="px-4 py-2 bg-app-primary hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md transition-colors"
                >
                  {isCreatingModule ? 'Creating...' : 'Create Module'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedLeftPanel;
