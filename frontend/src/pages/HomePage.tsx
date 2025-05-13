// frontend/src/pages/HomePage.tsx
import React, { useEffect, useState } from "react";
import { getApiHealth } from "../services/api";

const HomePage: React.FC = () => {
  const [healthStatus, setHealthStatus] = useState<string>(
    "Checking API health..."
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const data = await getApiHealth();
        setHealthStatus(
          `API Status: ${data.status} - Message: ${data.message}`
        );
        setError(null);
      } catch (err) {
        setHealthStatus("API health check failed.");
        setError(
          "Could not connect to the API. Ensure the backend is running."
        );
        console.error(err);
      }
    };
    checkHealth();
  }, []);

  return (
    <div>
      <h1>Welcome to the Advanced Roleplay Engine</h1>
      <p>{healthStatus}</p>
      {error && <p style={{ color: "red" }}>{error}</p>}
      <p>Navigate to "Settings" to configure your application.</p>
    </div>
  );
};

export default HomePage;
