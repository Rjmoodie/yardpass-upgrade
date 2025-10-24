import type { Config } from "tailwindcss"

export default {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        sm: "1rem",
        md: "1.25rem",
        lg: "1.5rem",
        xl: "2rem",
        "2xl": "2.5rem",
      },
      screens: {
        xs: "360px",  // iPhone mini / compact devices
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
        "2xl": "1400px",
      },
    },
    extend: {
      screens: {
        "tall": { raw: "(min-height: 740px)" },   // thumb reach tuning
        "short": { raw: "(max-height: 680px)" },  // dense layouts
      },
      colors: {
        // Refined neutral system for premium feel
        neutral: {
          900: "#0F172A",   // Dark slate for primary text
          800: "#1E293B",   // Slate for headings
          700: "#334155",   // Medium slate
          600: "#475569",   // Soft slate
          500: "#64748B",   // Muted slate
          400: "#94A3B8",   // Light slate
          300: "#CBD5E1",   // Very light slate
          200: "#E2E8F0",   // Divider color
          100: "#F1F5F9",   // Background tint
          50: "#F8FAFC",    // Soft background
          0: "#FFFFFF",     // Pure white
        },
        // Updated brand system with cool professional tones
        brand: {
          600: "#1D4ED8",   // Deep brand accent
          500: "#2563EB",   // Primary brand blue
          400: "#3B82F6",   // Hover state
          300: "#60A5FA",   // Light accent wash
          200: "#93C5FD",   // Soft accent background
          100: "#DBEAFE",   // Ultra light accent
          50: "#EEF2FF",    // Delicate brand tint
        },
        // Semantic colors
        success: "#16A34A",
        warning: "#F59E0B", 
        danger: "#DC2626",
        
        // Keep existing CSS variables for compatibility
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
          glow: "hsl(var(--primary-glow))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      fontFamily: {
        sans: ["Inter", "SF Pro Display", "system-ui", "sans-serif"],
        display: ["Inter", "SF Pro Display", "system-ui", "sans-serif"],
        mono: ["SF Mono", "Monaco", "Consolas", "monospace"],
      },
      fontSize: {
        // Refined typography scale
        xs: ["0.75rem", { lineHeight: "1rem", letterSpacing: "0.025em" }],      // 12px
        sm: ["0.875rem", { lineHeight: "1.25rem", letterSpacing: "0.025em" }],  // 14px
        base: ["1rem", { lineHeight: "1.5rem", letterSpacing: "0" }],           // 16px
        lg: ["1.125rem", { lineHeight: "1.75rem", letterSpacing: "0" }],       // 18px
        xl: ["1.25rem", { lineHeight: "1.75rem", letterSpacing: "-0.025em" }], // 20px
        "2xl": ["1.375rem", { lineHeight: "2rem", letterSpacing: "-0.025em" }], // 22px
        "3xl": ["1.5rem", { lineHeight: "2rem", letterSpacing: "-0.025em" }],   // 24px
        "4xl": ["1.875rem", { lineHeight: "2.25rem", letterSpacing: "-0.025em" }], // 30px
        "5xl": ["2.25rem", { lineHeight: "2.5rem", letterSpacing: "-0.025em" }], // 36px
      },
      spacing: {
        // 8pt grid system for consistent spacing
        "0.5": "2px",   // 0.25 * 8
        "1": "4px",     // 0.5 * 8
        // Density spacing tokens
        "comfortable": "var(--spacing-comfortable, 1rem)",
        "compact": "var(--spacing-compact, 0.5rem)",
        "1.5": "6px",   // 0.75 * 8
        "2": "8px",     // 1 * 8
        "3": "12px",    // 1.5 * 8
        "4": "16px",    // 2 * 8
        "5": "20px",    // 2.5 * 8
        "6": "24px",    // 3 * 8
        "8": "32px",    // 4 * 8
        "10": "40px",   // 5 * 8
        "12": "48px",   // 6 * 8
        "16": "64px",   // 8 * 8
        "20": "80px",   // 10 * 8
        "24": "96px",   // 12 * 8
        "32": "128px",  // 16 * 8
        "40": "160px",  // 20 * 8
        "48": "192px",  // 24 * 8
        "56": "224px",  // 28 * 8
        "64": "256px",  // 32 * 8
        // Safe area spacing
        "safe-top": "var(--safe-area-inset-top)",
        "safe-bottom": "var(--safe-area-inset-bottom)",
        "safe-left": "var(--safe-area-inset-left)",
        "safe-right": "var(--safe-area-inset-right)",
        "safe-or-2": "max(env(safe-area-inset-bottom, 0rem), 0.5rem)",
        "safe-or-4": "max(env(safe-area-inset-bottom, 0rem), 1rem)",
        "safe-top-or-2": "max(env(safe-area-inset-top, 0rem), 0.5rem)",
        "safe-top-or-4": "max(env(safe-area-inset-top, 0rem), 1rem)",
      },
      borderRadius: {
        // Refined corner radius system
        xs: "4px",
        sm: "6px", 
        md: "12px",   // Consistent 12px for cards/buttons
        lg: "16px",
        xl: "20px",
        pill: "9999px",
        // Keep existing variables for compatibility
        "xs-var": "var(--radius-xs)",
        "sm-var": "var(--radius-sm)",
        "md-var": "var(--radius-md)",
        "lg-var": "var(--radius-lg)",
        "xl-var": "var(--radius-xl)",
        "2xl-var": "var(--radius-2xl)",
        "3xl-var": "var(--radius-3xl)",
        full: "var(--radius-full)",
      },
      boxShadow: {
        // Refined shadow system for premium feel
        subtle: "0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)",
        card: "0 1px 2px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06)",
        elevated: "0 4px 12px rgba(0,0,0,0.08), 0 16px 32px rgba(0,0,0,0.12)",
        focus: "0 0 0 3px rgba(37,99,235,0.18)",
        brand: "0 0 0 3px rgba(37,99,235,0.18)",
        // Keep existing variables for compatibility
        sm: "var(--shadow-sm)",
        md: "var(--shadow-md)",
        lg: "var(--shadow-lg)",
        xl: "var(--shadow-xl)",
        glow: "var(--shadow-glow)",
        elevated: "var(--shadow-elevated)",
      },
      backdropBlur: {
        glass: "20px",
      },
      transitionTimingFunction: {
        ios: "var(--ease-out)",
        "ios-in-out": "var(--ease-in-out)",
        spring: "var(--ease-spring)",
      },
      transitionDuration: {
        // Motion tokens from design system
        fast: "var(--duration-fast, 120ms)",
        normal: "var(--duration-normal, 200ms)",
        slow: "var(--duration-slow, 300ms)",
        // Legacy aliases
        quick: "200ms",
        smooth: "300ms",
        spring: "400ms",
      },
      zIndex: {
        rail: "40",
        toast: "50",
        modal: "50",
        popover: "100",
        dropdown: "100",
      },
      minHeight: {
        'dvh': '100dvh', // dynamic viewport height for iOS
      },
      overscrollBehavior: {
        'none': 'none',
        'contain': 'contain',
      },
      opacity: {
        15: "0.15",
        85: "0.85",
      },
      keyframes: {
        "accordion-down": { from: { height: "0" }, to: { height: "var(--radix-accordion-content-height)" } },
        "accordion-up":   { from: { height: "var(--radix-accordion-content-height)" }, to: { height: "0" } },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        "fade-out": {
          "0%": { opacity: "1", transform: "translateY(0)" },
          "100%": { opacity: "0", transform: "translateY(10px)" }
        },
        "slide-up": {
          "0%": { transform: "translateY(100%)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" }
        },
        "slide-down": {
          "0%": { transform: "translateY(-100%)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" }
        },
        "scale-in": {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" }
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" }
        }
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
        "fade-out": "fade-out 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        "slide-up": "slide-up 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
        "slide-down": "slide-down 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
        "scale-in": "scale-in 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        shimmer: "shimmer 2s linear infinite",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
  ],
} satisfies Config