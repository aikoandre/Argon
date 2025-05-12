# backend-python/main.py
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
import json
import os
from openai import OpenAI # Import OpenAI library
from dotenv import load_dotenv
import uuid
from typing import List, Optional, Dict, Any

# Import models
from models import (
    ScenarioCard,
    CharacterCard,
    GlobalLoreEntry,
    UserSettings,
    ChatInput,
    ChatResponse,
    NewChatRequest,
    NewChatResponse
)

load_dotenv() # Load environment variables from .env file

# --- Configuration for Data Storage ---
DATA_DIR = "app_data"
SCENARIOS_DIR = os.path.join(DATA_DIR, "scenarios")
CHARACTERS_DIR = os.path.join(DATA_DIR, "characters")
GLOBAL_LORE_DIR = os.path.join(DATA_DIR, "global_lore")
SETTINGS_FILE = os.path.join(DATA_DIR, "user_settings.json")
# For MVP, chat history and session state can be simple files or in-memory
# Later, this will be SQLite
CHAT_SESSIONS_DIR = os.path.join(DATA_DIR, "chat_sessions")


# --- Helper Functions for Data Storage (JSON files for MVP) ---
def ensure_dirs():
    os.makedirs(SCENARIOS_DIR, exist_ok=True)
    os.makedirs(CHARACTERS_DIR, exist_ok=True)
    os.makedirs(GLOBAL_LORE_DIR, exist_ok=True)
    os.makedirs(CHAT_SESSIONS_DIR, exist_ok=True)

ensure_dirs() # Create directories if they don't exist

def save_json_data(file_path: str, data: BaseModel):
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(data.model_dump(), f, indent=2)

def load_json_data(file_path: str, model_type: type[BaseModel]):
    if not os.path.exists(file_path):
        return None
    with open(file_path, "r", encoding="utf-8") as f:
        try:
            data = json.load(f)
            return model_type(**data)
        except json.JSONDecodeError:
            return None # Or raise an error

def list_json_files(directory: str, model_type: type[BaseModel]) -> List[BaseModel]:
    items = []
    if not os.path.exists(directory):
        return items
    for filename in os.listdir(directory):
        if filename.endswith(".json"):
            item = load_json_data(os.path.join(directory, filename), model_type)
            if item:
                items.append(item)
    return items

def delete_json_file(file_path: str):
    if os.path.exists(file_path):
        os.remove(file_path)
        return True
    return False

# --- FastAPI App Initialization ---
app = FastAPI()

origins = [
    "http://localhost:5173", # Vite default
    # Add other origins if needed, e.g., for your Electron app if it uses a different port in some cases
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Global In-memory Store for Chat Session State (for MVP) ---
# Later, this should be persisted, e.g., in SQLite
# Key: chat_id, Value: Dict with session specific data
active_chat_sessions_state: Dict[str, Dict[str, Any]] = {}

# --- API Endpoints ---

@app.get("/")
async def read_root():
    return {"message": "Welcome to the Advanced Roleplay Backend!"}

# --- ScenarioCard Endpoints ---
@app.post("/api/scenarios", response_model=ScenarioCard, status_code=201)
async def create_scenario(scenario: ScenarioCard):
    file_path = os.path.join(SCENARIOS_DIR, f"{scenario.id}.json")
    save_json_data(file_path, scenario)
    return scenario

@app.get("/api/scenarios", response_model=List[ScenarioCard])
async def get_all_scenarios():
    return list_json_files(SCENARIOS_DIR, ScenarioCard)

@app.get("/api/scenarios/{scenario_id}", response_model=ScenarioCard)
async def get_scenario(scenario_id: str):
    scenario = load_json_data(os.path.join(SCENARIOS_DIR, f"{scenario_id}.json"), ScenarioCard)
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return scenario

@app.put("/api/scenarios/{scenario_id}", response_model=ScenarioCard)
async def update_scenario(scenario_id: str, scenario_update: ScenarioCard):
    file_path = os.path.join(SCENARIOS_DIR, f"{scenario_id}.json")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Scenario not found to update")
    # Ensure ID is not changed by the update payload
    if scenario_update.id != scenario_id:
        scenario_update.id = scenario_id
    save_json_data(file_path, scenario_update)
    return scenario_update

@app.delete("/api/scenarios/{scenario_id}", status_code=204)
async def delete_scenario(scenario_id: str):
    if not delete_json_file(os.path.join(SCENARIOS_DIR, f"{scenario_id}.json")):
        raise HTTPException(status_code=404, detail="Scenario not found to delete")
    return

# --- CharacterCard Endpoints (Similar CRUD for Characters) ---
@app.post("/api/characters", response_model=CharacterCard, status_code=201)
async def create_character(character: CharacterCard):
    file_path = os.path.join(CHARACTERS_DIR, f"{character.id}.json")
    save_json_data(file_path, character)
    return character

@app.get("/api/characters", response_model=List[CharacterCard])
async def get_all_characters():
    return list_json_files(CHARACTERS_DIR, CharacterCard)

@app.get("/api/characters/{character_id}", response_model=CharacterCard)
async def get_character(character_id: str):
    character = load_json_data(os.path.join(CHARACTERS_DIR, f"{character_id}.json"), CharacterCard)
    if not character:
        raise HTTPException(status_code=404, detail="Character not found")
    return character

@app.put("/api/characters/{character_id}", response_model=CharacterCard)
async def update_character(character_id: str, character_update: CharacterCard):
    file_path = os.path.join(CHARACTERS_DIR, f"{character_id}.json")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Character not found to update")
    if character_update.id != character_id: # Ensure ID consistency
        character_update.id = character_id
    save_json_data(file_path, character_update)
    return character_update

@app.delete("/api/characters/{character_id}", status_code=204)
async def delete_character(character_id: str):
    if not delete_json_file(os.path.join(CHARACTERS_DIR, f"{character_id}.json")):
        raise HTTPException(status_code=404, detail="Character not found to delete")
    # Consider also deleting this character if it's part of any active_chat_sessions_state
    # or if it's referenced elsewhere (more complex logic for later)
    return

# --- GlobalLoreEntry Endpoints (Similar CRUD for Global Lore) ---
@app.post("/api/global_lore", response_model=GlobalLoreEntry, status_code=201)
async def create_global_lore_entry(entry: GlobalLoreEntry):
    file_path = os.path.join(GLOBAL_LORE_DIR, f"{entry.id}.json")
    save_json_data(file_path, entry)
    return entry

@app.get("/api/global_lore", response_model=List[GlobalLoreEntry])
async def get_all_global_lore_entries():
    return list_json_files(GLOBAL_LORE_DIR, GlobalLoreEntry)

@app.get("/api/global_lore/{entry_id}", response_model=GlobalLoreEntry)
async def get_global_lore_entry(entry_id: str):
    entry = load_json_data(os.path.join(GLOBAL_LORE_DIR, f"{entry_id}.json"), GlobalLoreEntry)
    if not entry:
        raise HTTPException(status_code=404, detail="Global lore entry not found")
    return entry

@app.put("/api/global_lore/{entry_id}", response_model=GlobalLoreEntry)
async def update_global_lore_entry(entry_id: str, entry_update: GlobalLoreEntry):
    file_path = os.path.join(GLOBAL_LORE_DIR, f"{entry_id}.json")
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Global lore entry not found to update")
    if entry_update.id != entry_id: # Ensure ID consistency
        entry_update.id = entry_id
    save_json_data(file_path, entry_update)
    return entry_update

@app.delete("/api/global_lore/{entry_id}", status_code=204)
async def delete_global_lore_entry(entry_id: str):
    if not delete_json_file(os.path.join(GLOBAL_LORE_DIR, f"{entry_id}.json")):
        raise HTTPException(status_code=404, detail="Global lore entry not found to delete")
    return


# --- UserSettings Endpoints ---
@app.get("/api/settings", response_model=UserSettings)
async def get_user_settings():
    settings = load_json_data(SETTINGS_FILE, UserSettings)
    if not settings:
        return UserSettings() # Return default settings if file doesn't exist
    return settings

@app.post("/api/settings", response_model=UserSettings)
async def save_user_settings(settings: UserSettings):
    save_json_data(SETTINGS_FILE, settings)
    return settings

# --- Chat Session Management Endpoints ---
@app.post("/api/chats", response_model=NewChatResponse, status_code=201)
async def create_new_chat_session(request: NewChatRequest):
    chat_id = str(uuid.uuid4())
    beginning_msg = "Welcome to the roleplay!" # Default

    # Determine starting context (Scenario or GM Character)
    if request.scenario_id:
        scenario = load_json_data(os.path.join(SCENARIOS_DIR, f"{request.scenario_id}.json"), ScenarioCard)
        if not scenario:
            raise HTTPException(status_code=404, detail="Scenario not found for new chat")
        beginning_msg = scenario.beginning_message
        # Store initial session state
        active_chat_sessions_state[chat_id] = {
            "type": "scenario",
            "id": request.scenario_id,
            "user_character_id": request.user_character_id,
            "history": [{"sender": "system", "message": beginning_msg}], # Store history here for MVP
            "current_time": "Monday, April 15th, 9:00 AM", # Example initial time
            "current_location": "U.A. High School - Classroom 1-A", # Example initial location
            "current_event_context": "Beginning of a new day" # Example
        }
    elif request.gm_character_id:
        gm_char = load_json_data(os.path.join(CHARACTERS_DIR, f"{request.gm_character_id}.json"), CharacterCard)
        if not gm_char:
            raise HTTPException(status_code=404, detail="GM Character not found for new chat")
        beginning_msg = gm_char.beginning_message or "The character looks at you expectantly."
        active_chat_sessions_state[chat_id] = {
            "type": "character_gm",
            "id": request.gm_character_id,
            "user_character_id": request.user_character_id,
            "history": [{"sender": "system", "message": beginning_msg}],
             # ... initial time/location/context for character GMs might be different or less defined
        }
    else:
        raise HTTPException(status_code=400, detail="Either scenario_id or gm_character_id must be provided")

    # For MVP, chat history is simple list in active_chat_sessions_state
    # Later, this will be SQLite
    chat_history_file = os.path.join(CHAT_SESSIONS_DIR, f"{chat_id}_history.json")
    with open(chat_history_file, "w", encoding="utf-8") as f:
        json.dump([{"sender": "system", "message": beginning_msg, "timestamp": "initial"}], f, indent=2)


    return NewChatResponse(chat_id=chat_id, beginning_message=beginning_msg)

@app.get("/api/chats/{chat_id}/messages") # Example, refine as needed
async def get_chat_messages(chat_id: str):
    # For MVP, load from file. Later from SQLite.
    chat_history_file = os.path.join(CHAT_SESSIONS_DIR, f"{chat_id}_history.json")
    if not os.path.exists(chat_history_file):
        raise HTTPException(status_code=404, detail="Chat history not found")
    with open(chat_history_file, "r", encoding="utf-8") as f:
        history = json.load(f)
    return history


# --- Main Chat Endpoint (com Chamada LLM Real) ---
@app.post("/api/chat", response_model=ChatResponse)
async def handle_chat(chat_data: ChatInput):
    print(f"Received for chat {chat_data.chat_id}: {chat_data.user_input}")

    session_state = active_chat_sessions_state.get(chat_data.chat_id)
    if not session_state:
        raise HTTPException(status_code=404, detail="Chat session not found. Create a new chat first.")

    # --- 1. Load context based on session type ---
    prompt_context_parts = [] # Use a list to build context parts
    if session_state["type"] == "scenario":
        scenario = load_json_data(os.path.join(SCENARIOS_DIR, f"{session_state['id']}.json"), ScenarioCard)
        if scenario:
            prompt_context_parts.append(f"### Scenario Overview ###\nName: {scenario.scenario_name}\nDescription: {scenario.scenario_description}\n")
            # Add world lore references if any (basic for now)
            if scenario.world_lore_references:
                 prompt_context_parts.append(f"Key Scenario Lore Tags to consider: {', '.join(scenario.world_lore_references)}\n")
    elif session_state["type"] == "character_gm":
        gm_char = load_json_data(os.path.join(CHARACTERS_DIR, f"{session_state['id']}.json"), CharacterCard)
        if gm_char:
            prompt_context_parts.append(f"### You are GMing as: {gm_char.character_name} ###\nCharacter Description (Personality, Backstory, Abilities): {gm_char.character_description}\n")
            if gm_char.dialogue_examples:
                prompt_context_parts.append("Dialogue Examples:\n" + "\n".join([f"- \"{ex}\"" for ex in gm_char.dialogue_examples]) + "\n")
            if gm_char.world_lore_references:
                prompt_context_parts.append(f"Key Character Lore Tags to consider: {', '.join(gm_char.world_lore_references)}\n")

    # --- 2. RAG (Very Simple MVP: Search Global Lore by Tags) ---
    relevant_lore_strings = []
    all_lore_entries = list_json_files(GLOBAL_LORE_DIR, GlobalLoreEntry)
    user_input_tokens_set = set(chat_data.user_input.lower().split()) # More efficient for checking

    for lore_entry in all_lore_entries:
        # Check if any tag in the lore entry is mentioned in the user input
        # or if any tag from scenario/character references matches this lore entry's tags
        # This is still basic, a proper RAG would be more sophisticated
        lore_tags_set = set(tag.lower() for tag in lore_entry.tags)
        # Add more sophisticated matching logic here later
        if user_input_tokens_set.intersection(lore_tags_set): # Simple keyword match
            relevant_lore_strings.append(f"Relevant Lore ({lore_entry.title}): {lore_entry.content}")

    if relevant_lore_strings:
        prompt_context_parts.append("### Relevant World Lore (Consider this information) ###\n" + "\n".join(relevant_lore_strings) + "\n### End Lore ###\n")

    # --- 3. Get Recent Chat History ---
    chat_history_file = os.path.join(CHAT_SESSIONS_DIR, f"{chat_data.chat_id}_history.json")
    current_history = []
    if os.path.exists(chat_history_file):
        with open(chat_history_file, "r", encoding="utf-8") as f:
            current_history = json.load(f)

    # Build messages for LLM API (system, user, assistant format)
    # For MVP, we'll construct a simpler text block, but OpenAI API prefers message list
    messages_for_llm = []
    
    # System Prompt part (built from scenario/character description)
    system_prompt_content = "You are an AI Game Master for an advanced roleplaying game.\n"
    system_prompt_content += "".join(prompt_context_parts) # Add scenario/GM char desc and RAG lore
    system_prompt_content += "\nRespond naturally as the Game Master or the character you are portraying. Continue the story based on the user's input and the established context."
    messages_for_llm.append({"role": "system", "content": system_prompt_content.strip()})

    # Add recent history
    # OpenAI API expects alternating user/assistant roles
    # We need to adapt our simple history format
    history_to_include = current_history[-6:] # e.g., last 3 user/AI pairs
    for msg_entry in history_to_include:
        role = "user" if msg_entry["sender"].lower() == "user" else "assistant"
        messages_for_llm.append({"role": role, "content": msg_entry["message"]})

    # Add current user input
    messages_for_llm.append({"role": "user", "content": chat_data.user_input})

    print("\n--- MESSAGES SENT TO LLM ---")
    for msg in messages_for_llm:
        print(f"Role: {msg['role']}")
        # print(f"Content: {msg['content'][:300]}...") # Print a snippet
    print("--- END MESSAGES ---\n")

    # --- 4. Call LLM (OpenRouter) ---
    ia_generated_text = "Error: LLM call not implemented or failed." # Default error
    settings = load_json_data(SETTINGS_FILE, UserSettings)
    if not settings: # Se o arquivo não existe ou está vazio, use defaults
        settings = UserSettings() # Isso usará o default que você definiu no Pydantic model

    if not settings.openrouter_api_key:
        print("FATAL: OpenRouter API key not configured in settings. Cannot call LLM.")
        # Você pode retornar um erro HTTP aqui, ou uma mensagem específica para a UI
        # raise HTTPException(status_code=503, detail="LLM service not configured: API Key missing.")
        # Para teste, podemos deixar a mensagem de erro que já estava:
        ia_generated_text = "[LLM NOT CALLED: OpenRouter API Key not configured in settings. Please set it in the Settings page.]"
        # ... (resto da lógica para construir ChatResponse e salvar no histórico) ...
        # return ChatResponse(ai_response=final_ai_response, chat_id=chat_data.chat_id)
    else:
        try:
            client = OpenAI(
                base_url="https://openrouter.ai/api/v1",
                api_key=settings.openrouter_api_key, # <<< USA A CHAVE DAS CONFIGURAÇÕES
            )
            completion = client.chat.completions.create(
                model=settings.selected_llm_model or "google/gemini-flash-1.5", # <<< USA O MODELO DAS CONFIGURAÇÕES
                messages=messages_for_llm,
                # temperature=0.7, # Adjust as needed
                # max_tokens=500,  # Adjust as needed
            )
            if completion.choices and completion.choices[0].message:
                 ia_generated_text = completion.choices[0].message.content or "[LLM returned empty message]"
            else:
                ia_generated_text = "[LLM did not return a valid choice]"
        except Exception as e:
            print(f"Error calling OpenRouter API: {e}")
            ia_generated_text = f"[Error communicating with LLM: {e}]"


    # --- 5. Post-Processing (Scene Header for MVP) ---
    if chat_data.current_scene_time:
        session_state["current_time"] = chat_data.current_scene_time
    if chat_data.current_scene_location:
        session_state["current_location"] = chat_data.current_scene_location
    if chat_data.current_scene_context:
        session_state["current_event_context"] = chat_data.current_scene_context

    header = ""
    # Simple logic: add header if scene info exists and this is an AI response
    # A more robust "scene_changed" flag would be better later.
    if session_state.get("current_time") and session_state.get("current_location"):
        header = f"[System: [{session_state.get('current_time','Time N/A')} - {session_state.get('current_location','Location N/A')} - {session_state.get('current_event_context','Context N/A')}]\n\n"
        # Note: Removed ``` for now as it might interfere with markdown rendering in chat UI

    final_ai_response = f"{header}{ia_generated_text}"

    # --- 6. Save to History ---
    # Ensure current_history is the most up-to-date before appending
    if os.path.exists(chat_history_file): # Reload to avoid race conditions if multiple writes happen (unlikely in MVP)
        with open(chat_history_file, "r", encoding="utf-8") as f:
            current_history = json.load(f)
    else: # Should have been created by /api/chats
        current_history = []


    current_history.append({"sender": "user", "message": chat_data.user_input, "timestamp": "now_user"}) # More distinct timestamp
    current_history.append({"sender": "ai", "message": ia_generated_text, "timestamp": "now_ai"}) # Save raw AI text before header for history
    with open(chat_history_file, "w", encoding="utf-8") as f:
        json.dump(current_history, f, indent=2)

    return ChatResponse(ai_response=final_ai_response, chat_id=chat_data.chat_id)


if __name__ == "__main__":
    print("Starting backend server...")
    # Ensure the app reloads on code changes during development
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
