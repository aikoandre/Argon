import type { CharacterCardData } from '../services/api';

export const characterToFormData = (character: CharacterCardData): FormData => {
  const formData = new FormData();
  
  // Add individual form fields as expected by the backend
  formData.append('name', character.name || '');
  formData.append('description', character.description || '');
  formData.append('instructions', character.instructions || '');
  
  // JSON fields need to be stringified
  formData.append('example_dialogues', JSON.stringify(character.example_dialogues || []));
  formData.append('beginning_messages', JSON.stringify(character.beginning_messages || []));
  formData.append('linked_lore_ids', JSON.stringify(character.linked_lore_ids || []));
  
  if (character.master_world_id) {
    formData.append('master_world_id', character.master_world_id);
  }
  
  return formData;
};

export const scenarioToFormData = (scenario: any): FormData => {
  const formData = new FormData();
  
  const dataObj = {
    name: scenario.name || '',
    description: scenario.description || '',
    instructions: scenario.instructions || '',
    image_url: scenario.image_url || '',
  };
  
  formData.append('data', JSON.stringify(dataObj));
  return formData;
};

export const personaToFormData = (persona: any): FormData => {
  const formData = new FormData();
  
  const dataObj = {
    name: persona.name || '',
    description: persona.description || '',
    instructions: persona.instructions || '',
  };
  
  formData.append('data', JSON.stringify(dataObj));
  return formData;
};

export const loreEntryToFormData = (loreEntry: any): FormData => {
  const formData = new FormData();
  
  const dataObj = {
    name: loreEntry.name || '',
    content: loreEntry.content || '',
    world_id: loreEntry.world_id || '',
  };
  
  formData.append('data', JSON.stringify(dataObj));
  return formData;
};