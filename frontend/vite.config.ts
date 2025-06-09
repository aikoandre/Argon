import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Enable access from any host
    port: 5173,
    hmr: {
      overlay: true, // Show error overlay
    },
    watch: {
      usePolling: true, // Use polling for file watching (helpful in some environments)
    },
    proxy: {
      '/api': {
        target: 'http://localhost:7000', // Your backend server address
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api'), // Keep /api in the path
      },
      '/static': { // Add proxy for static files
        target: 'http://localhost:7000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/static/, '/static'), // Keep /static in the path
      },
    },
  },
});
