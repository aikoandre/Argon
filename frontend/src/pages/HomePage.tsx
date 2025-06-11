// frontend/src/pages/HomePage.tsx
import React, { useEffect, useState } from "react";
import { getApiHealth } from "../services/api";
import { useLayout } from "../contexts/LayoutContext";

const HomePage: React.FC = () => {
  const { setLeftPanelVisible, setRightPanelVisible } = useLayout();
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

  // Hide panels for home page
  useEffect(() => {
    setLeftPanelVisible(false);
    setRightPanelVisible(false);
  }, [setLeftPanelVisible, setRightPanelVisible]);

  return (
    <div className="text-center text-white">
      <h1 className="text-7xl mb-4 font-bold font-quintessential">Argon</h1>
      <p>{healthStatus}</p>
      {error && <p className="text-red-500">{error}</p>}
    </div>
  );
};

export default HomePage;
