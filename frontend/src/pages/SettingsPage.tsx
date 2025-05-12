// src/pages/SettingsPage.tsx (exemplo)
import React, { useState, useEffect } from "react";

interface UserSettingsData {
  openrouter_api_key?: string;
  selected_llm_model?: string;
}

function SettingsPage() {
  const [settings, setSettings] = useState<UserSettingsData>({});
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    // Carregar configurações existentes
    fetch("http://localhost:8000/api/settings")
      .then((res) => res.json())
      .then((data: UserSettingsData) => {
        setSettings(data);
        setApiKey(data.openrouter_api_key || "");
        setModel(data.selected_llm_model || "google/gemini-2.0-flash");
      })
      .catch((err) => console.error("Failed to load settings", err));
  }, []);

  const handleSave = async () => {
    try {
      const response = await fetch("http://localhost:8000/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          openrouter_api_key: apiKey,
          selected_llm_model: model,
        }),
      });
      if (response.ok) {
        setMessage("Settings saved successfully!");
        setSettings({ openrouter_api_key: apiKey, selected_llm_model: model });
      } else {
        setMessage("Failed to save settings.");
      }
    } catch (error) {
      console.error("Error saving settings:", error);
      setMessage("Error saving settings.");
    }
  };

  return (
    <div>
      <h2>Settings</h2>
      <div>
        <label htmlFor="apiKey">OpenRouter API Key:</label>
        <input
          type="password" // Para esconder a chave
          id="apiKey"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          style={{ width: "300px" }}
        />
      </div>
      <div>
        <label htmlFor="model">
          LLM Model (e.g., google/gemini-2.0-flash):
        </label>
        <input
          type="text"
          id="model"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          style={{ width: "300px" }}
        />
      </div>
      <button onClick={handleSave}>Save Settings</button>
      {message && <p>{message}</p>}
    </div>
  );
}
export default SettingsPage;
