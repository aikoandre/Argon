// frontend-react/src/apiService.ts
import axios from "axios";

// URL base da sua API FastAPI
// Certifique-se que a porta corresponde à que o Uvicorn está usando
const API_BASE_URL = "http://localhost:8000";

// Cria uma instância do Axios com a URL base configurada
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Função de exemplo para buscar dados da rota raiz do backend
export const fetchTestData = async () => {
  try {
    const response = await apiClient.get("/");
    return response.data; // Espera-se algo como { message: "..." }
  } catch (error) {
    console.error("Erro ao buscar dados de teste da API:", error);
    // Você pode querer tratar o erro de forma mais específica aqui
    if (axios.isAxiosError(error)) {
      // Erro específico do Axios (ex: problema de rede, CORS, erro 4xx/5xx)
      console.error(
        "Detalhes do erro Axios:",
        error.response?.data || error.message
      );
    }
    throw error; // Re-lança o erro para quem chamou a função poder tratar
  }
};

// --- Adicione outras funções de API aqui conforme necessário ---
// export const getUserSettings = async () => { ... };
// export const saveUserSettings = async (settings) => { ... };
// export const createScenarioCard = async (cardData) => { ... };

export default apiClient; // Exporta a instância para uso direto se necessário
