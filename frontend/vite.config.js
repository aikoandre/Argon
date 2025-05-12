// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Para build de produção com Electron, você pode precisar disso:
  // base: './', // Para caminhos relativos quando carregar via file://
});
