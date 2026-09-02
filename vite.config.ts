
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5000,
    host: '0.0.0.0',
    allowedHosts: true
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          const moduleId = id.replace(/\\/g, "/");
          if (moduleId.includes("/node_modules/@firebase/firestore/") || moduleId.includes("/node_modules/firebase/firestore/")) return "firebase-firestore";
          if (moduleId.includes("/node_modules/@firebase/app-check") || moduleId.includes("/node_modules/firebase/app-check/")) return "firebase-app-check";
          if (moduleId.includes("/node_modules/@firebase/auth/") || moduleId.includes("/node_modules/firebase/auth/")) return "firebase-auth";
          if (moduleId.includes("/node_modules/@firebase/functions/") || moduleId.includes("/node_modules/firebase/functions/")) return "firebase-functions";
          if (moduleId.includes("/node_modules/@firebase/storage/") || moduleId.includes("/node_modules/firebase/storage/")) return "firebase-storage";
          if (moduleId.includes("/node_modules/@firebase/") || moduleId.includes("/node_modules/firebase/")) return "firebase-core";
          if (moduleId.includes("/node_modules/react")) return "react";
          if (moduleId.includes("/node_modules/lucide-react")) return "icons";
          return undefined;
        },
      },
    },
  }
});
