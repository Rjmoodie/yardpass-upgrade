import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { splitVendorChunkPlugin } from "vite";
import { visualizer } from "rollup-plugin-visualizer";

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
        // 🎯 PERF-005: Enhanced manual chunks - reduce vendor.js from 521KB
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            // Heavy UI libraries (already split)
            if (id.includes('mapbox-gl')) return 'mapbox';
            if (id.includes('recharts')) return 'charts';
            if (id.includes('@mux/mux-player')) return 'video';
            if (id.includes('@stripe')) return 'stripe';
            if (id.includes('framer-motion')) return 'motion';
            if (id.includes('@radix-ui')) return 'ui';
            if (id.includes('posthog')) return 'analytics';
            
            // 🎯 NEW: Split more heavy libs from vendor
            if (id.includes('react-hook-form') || id.includes('zod')) return 'forms';
            if (id.includes('date-fns')) return 'dates';
            if (id.includes('dompurify')) return 'security';
            if (id.includes('@tanstack/react-virtual') || id.includes('react-window')) return 'virtual';
            if (id.includes('qrcode') || id.includes('qr-code-styling')) return 'qr';
            if (id.includes('hls.js')) return 'hls';
            if (id.includes('tus-js-client')) return 'upload';
            if (id.includes('@capacitor/')) return 'capacitor';
            
            // Core framework (keep in vendor for caching)
            if (id.includes('react/') || id.includes('react-dom/')) return 'vendor';
            if (id.includes('@supabase/supabase-js')) return 'vendor';
            if (id.includes('react-router')) return 'vendor';
            if (id.includes('@tanstack/react-query')) return 'vendor';
            
            // Everything else goes to vendor
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
    // 🎯 PERF-005: Bundle visualizer (only in production builds)
    mode === 'production' && visualizer({ 
      open: true,
      gzipSize: true,
      brotliSize: true,
      filename: 'bundle-analysis.html',
      template: 'treemap' // Treemap view for easy analysis
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
