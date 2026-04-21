
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Use '.' instead of process.cwd() to resolve the type error while maintaining correct envDir resolution
  const env = loadEnv(mode, '.', '');
  
  // Tenta pegar a chave da variável carregada pelo Vite ou diretamente do sistema (Vercel)
  const apiKey = env.API_KEY || process.env.API_KEY;

  return {
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(apiKey || ''),
      'global': {}
    },
    server: {
      port: 5000,
      host: '0.0.0.0',
      allowedHosts: true
    },
    build: {
      outDir: 'dist'
    }
  };
});
