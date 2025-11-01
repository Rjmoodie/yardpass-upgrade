import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { splitVendorChunkPlugin } from "vite";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  build: {
    target: 'es2020',
    sourcemap: mode === 'production' ? false : true,
    rollupOptions: {
      output: {
        // Security: avoid predictable chunk names
        chunkFileNames: mode === 'production' ? 'assets/[name]-[hash].js' : '[name].js',
        entryFileNames: mode === 'production' ? 'assets/[name]-[hash].js' : '[name].js',
        assetFileNames: mode === 'production' ? 'assets/[name]-[hash].[ext]' : '[name].[ext]',
        // Manual chunks: separate heavy vendors for better caching
        manualChunks: (id) => {
          // Map heavy libraries to separate chunks
          if (id.includes('node_modules')) {
            if (id.includes('mapbox-gl')) return 'mapbox';
            if (id.includes('recharts')) return 'charts';
            if (id.includes('@mux/mux-player')) return 'video';
            if (id.includes('@stripe')) return 'stripe';
            if (id.includes('framer-motion')) return 'motion';
            if (id.includes('@radix-ui')) return 'ui';
            if (id.includes('posthog')) return 'analytics';
            // All other vendor code
            return 'vendor';
          }
        }
      }
    }
  },
  plugins: [
    react(),
    splitVendorChunkPlugin(),
    mode === 'development' && componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
