// frontend/src/pages/NewChatPage.tsx
import React, { useState, useEffect, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import Select from "react-select"; // Usaremos react-select para os dropdowns
import {
  getAllScenarioCards,
  getAllCharacterCards,
  getAllUserPersonas,
  createOrGetCardChat,
} from "../services/api";

import type {
  ScenarioCardData,
  CharacterCardData,
  UserPersonaData,
} from "../services/api";

interface SelectOption {
  value: string;
  label: string;
}

const NewChatPage: React.FC = () => {
  const navigate = useNavigate();
  const [scenarios, setScenarios] = useState<SelectOption[]>([]);
  const [characters, setCharacters] = useState<SelectOption[]>([]);
  const [personas, setPersonas] = useState<SelectOption[]>([]);

  const [selectedScenario, setSelectedScenario] = useState<SelectOption | null>(
    null
  );
  const [selectedCharacter, setSelectedCharacter] =
    useState<SelectOption | null>(null);
  const [selectedPersona, setSelectedPersona] = useState<SelectOption | null>(
    null
  );

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [scenariosData, charactersData, personasData] = await Promise.all(
          [getAllScenarioCards(), getAllCharacterCards(), getAllUserPersonas()]
        );
        setScenarios(
          scenariosData.map((s: ScenarioCardData) => ({
            value: s.id,
            label: s.name,
          }))
        );
        setCharacters(
          charactersData.map((c: CharacterCardData) => ({
            value: c.id,
            label: c.name,
          }))
        );
        setPersonas(
          personasData.map((p: UserPersonaData) => ({
            value: p.id,
            label: p.name,
          }))
        );
      } catch (err) {
        setError("Failed to load necessary data for new chat.");
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedScenario && !selectedCharacter) {
      alert("Please select either a scenario or a GM character.");
      return;
    }
    if (!selectedPersona) {
      alert("Please select a user persona.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      let sessionId: string;
      if (selectedScenario) {
        sessionId = await createOrGetCardChat(
          "scenario",
          selectedScenario.value,
          selectedPersona.value
        );
      } else if (selectedCharacter) {
        sessionId = await createOrGetCardChat(
          "character",
          selectedCharacter.value,
          selectedPersona.value
        );
      } else {
        // This case should ideally not be reached due to the initial check
        throw new Error("No scenario or character selected.");
      }
      navigate(`/chat/${sessionId}`);
    } catch (err) {
      setError("Failed to create chat session.");
      console.error(err);
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <p className="text-center text-gray-400 p-10">
        Loading options for new chat...
      </p>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-8 max-w-2xl">
      <h1 className="text-4xl font-bold text-white mb-8 text-center">
        Start a New Conversation
      </h1>
      {error && (
        <p className="bg-red-700 text-white p-3 rounded-md mb-4 text-center">
          {error}
        </p>
      )}

      <form
        onSubmit={handleSubmit}
        className="bg-gray-800 p-6 md:p-8 rounded-lg shadow-xl space-y-6"
      >
        <div>
          <label
            htmlFor="scenario"
            className="block text-lg font-medium text-gray-300 mb-2"
          >
            Scenario:
          </label>
          <Select<SelectOption>
            inputId="scenario"
            options={scenarios}
            value={selectedScenario}
            onChange={(option) => setSelectedScenario(option)}
            placeholder="Select a Scenario..."
            isClearable
            className="text-black" // react-select precisa de estilo para tema escuro ou use `styles` prop
            classNamePrefix="react-select" // Para estilização mais fácil com CSS global se necessário
            styles={{
              // Exemplo de estilos básicos para tema escuro
              control: (base) => ({
                ...base,
                backgroundColor: "#2D3748",
                borderColor: "#4A5568",
              }),
              singleValue: (base) => ({ ...base, color: "white" }),
              menu: (base) => ({ ...base, backgroundColor: "#2D3748" }),
              option: (base, { isFocused, isSelected }) => ({
                ...base,
                backgroundColor: isSelected
                  ? "#4A5568"
                  : isFocused
                  ? "#384252"
                  : "#2D3748",
                color: "white",
                ":active": {
                  backgroundColor: "#4A5568",
                },
              }),
              placeholder: (base) => ({ ...base, color: "#A0AEC0" }),
            }}
          />
        </div>

        <div>
          <label
            htmlFor="character"
            className="block text-lg font-medium text-gray-300 mb-2"
          >
            GM Character (AI):
          </label>
          <Select<SelectOption>
            inputId="character"
            options={characters}
            value={selectedCharacter}
            onChange={(option) => setSelectedCharacter(option)}
            placeholder="Select a GM Character..."
            isClearable
            className="text-black"
            classNamePrefix="react-select"
            styles={{
              /* Copie os estilos acima ou crie um objeto de estilos reutilizável */
              control: (base) => ({
                ...base,
                backgroundColor: "#2D3748",
                borderColor: "#4A5568",
              }),
              singleValue: (base) => ({ ...base, color: "white" }),
              menu: (base) => ({ ...base, backgroundColor: "#2D3748" }),
              option: (base, { isFocused, isSelected }) => ({
                ...base,
                backgroundColor: isSelected
                  ? "#4A5568"
                  : isFocused
                  ? "#384252"
                  : "#2D3748",
                color: "white",
                ":active": { backgroundColor: "#4A5568" },
              }),
              placeholder: (base) => ({ ...base, color: "#A0AEC0" }),
            }}
          />
        </div>

        <div>
          <label
            htmlFor="persona"
            className="block text-lg font-medium text-gray-300 mb-2"
          >
            Your Persona:
          </label>
          <Select<SelectOption>
            inputId="persona"
            options={personas}
            value={selectedPersona}
            onChange={(option) => setSelectedPersona(option)}
            placeholder="Select Your Persona..."
            isClearable
            className="text-black"
            classNamePrefix="react-select"
            styles={{
              /* Copie os estilos acima ou crie um objeto de estilos reutilizável */
              control: (base) => ({
                ...base,
                backgroundColor: "#2D3748",
                borderColor: "#4A5568",
              }),
              singleValue: (base) => ({ ...base, color: "white" }),
              menu: (base) => ({ ...base, backgroundColor: "#2D3748" }),
              option: (base, { isFocused, isSelected }) => ({
                ...base,
                backgroundColor: isSelected
                  ? "#4A5568"
                  : isFocused
                  ? "#384252"
                  : "#2D3748",
                color: "white",
                ":active": { backgroundColor: "#4A5568" },
              }),
              placeholder: (base) => ({ ...base, color: "#A0AEC0" }),
            }}
          />
        </div>

        <button
          type="submit"
          disabled={
            isSubmitting ||
            isLoading ||
            !selectedScenario ||
            !selectedCharacter ||
            !selectedPersona
          }
          className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-4 rounded-lg shadow-md transition duration-150 ease-in-out disabled:opacity-50"
        >
          {isSubmitting ? "Starting Chat..." : "Start Chat"}
        </button>
      </form>
    </div>
  );
};

export default NewChatPage;
