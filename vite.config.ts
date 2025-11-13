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
            if (id.includes('framer-motion') || id.includes('motion-dom')) return 'motion';
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
            
            // 🎯 OPTIMIZATION: Split core framework into separate chunks
            // This prevents vendor.js from becoming too large
            if (id.includes('react-dom/')) return 'react-dom';
            if (id.includes('react/') && !id.includes('react-dom')) return 'react';
            if (id.includes('@supabase/supabase-js')) return 'supabase';
            if (id.includes('react-router')) return 'router';
            if (id.includes('@tanstack/react-query')) return 'react-query';
            if (id.includes('lucide-react')) return 'icons';
            
            // 🎯 AGGRESSIVE OPTIMIZATION: Split more libraries to reduce vendor
            if (id.includes('sonner')) return 'toast';
            if (id.includes('class-variance-authority') || id.includes('clsx') || id.includes('tailwind-merge')) return 'utils';
            if (id.includes('next-themes')) return 'theme';
            if (id.includes('react-helmet')) return 'helmet';
            if (id.includes('cmdk')) return 'command';
            if (id.includes('vaul')) return 'drawer';
            if (id.includes('embla-carousel')) return 'carousel';
            if (id.includes('react-day-picker')) return 'date-picker';
            if (id.includes('input-otp')) return 'otp';
            if (id.includes('react-resizable-panels')) return 'panels';
            if (id.includes('react-virtualized')) return 'virtual';
            
            // Small utilities can stay in vendor (should be < 50KB now)
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
