# 🎨 YardPass Global Design System

Complete reference for the global design language, visual identity, and design patterns used throughout the YardPass application.

---

## 📐 DESIGN PHILOSOPHY

### **Core Principles**

**1. Dark-First Design**
- Primary background: Pure black (`#000000`)
- Reduces eye strain in low-light conditions
- Makes content (images, videos) pop
- Modern, premium feel

**2. Content-First**
- Full-screen immersive experiences
- Minimal UI chrome
- Content takes center stage
- Gestural interactions

**3. Social-Native**
- Familiar interaction patterns (swipe, tap, hold)
- Instant feedback
- Real-time updates
- Community-focused features

**4. Mobile-First, Web-Enhanced**
- Optimized for mobile touch
- Enhanced features on web
- Consistent experience across platforms
- Platform-specific optimizations

---

## 🎨 COLOR SYSTEM

### **Primary Colors**

```css
/* Background Colors */
--color-black: #000000;              /* Pure black - main background */
--color-neutral-950: #0a0a0a;        /* Near black - cards */
--color-neutral-900: #171717;        /* Dark gray - elevated surfaces */
--color-neutral-800: #262626;        /* Medium dark - borders */

/* Brand Colors */
--color-yardpass-yellow: #FFCC00;    /* Primary brand color */
--color-yardpass-yellow-hover: #FFD633; /* Hover state */
--color-yardpass-yellow-active: #E6B800; /* Active state */

/* Text Colors */
--color-white: #FFFFFF;              /* Primary text */
--color-white-90: rgba(255, 255, 255, 0.9); /* Secondary text */
--color-white-70: rgba(255, 255, 255, 0.7); /* Tertiary text */
--color-white-60: rgba(255, 255, 255, 0.6); /* Disabled text */
--color-white-50: rgba(255, 255, 255, 0.5); /* Placeholder text */
--color-white-20: rgba(255, 255, 255, 0.2); /* Borders */
--color-white-10: rgba(255, 255, 255, 0.1); /* Subtle borders */
--color-white-05: rgba(255, 255, 255, 0.05); /* Background tint */
```

### **Semantic Colors**

```css
/* Success / Positive */
--color-success: #10B981;            /* Green - success states */
--color-success-light: #34D399;      /* Light green - hover */
--color-success-dark: #059669;       /* Dark green - active */

/* Error / Destructive */
--color-error: #EF4444;              /* Red - errors, alerts */
--color-error-light: #F87171;        /* Light red - hover */
--color-error-dark: #DC2626;         /* Dark red - active */

/* Warning / Caution */
--color-warning: #F59E0B;            /* Orange - warnings */
--color-warning-light: #FBBF24;      /* Light orange - hover */
--color-warning-dark: #D97706;       /* Dark orange - active */

/* Info / Primary Action */
--color-info: #3B82F6;               /* Blue - info, links */
--color-info-light: #60A5FA;         /* Light blue - hover */
--color-info-dark: #2563EB;          /* Dark blue - active */

/* Accent Colors */
--color-purple: #8B5CF6;             /* Purple - premium features */
--color-pink: #EC4899;               /* Pink - highlights */
--color-orange: #FF8C00;             /* Orange - tickets, CTAs */
```

### **Gradient Overlays**

```css
/* Image Overlays */
--gradient-overlay-top: linear-gradient(
  to bottom,
  rgba(0, 0, 0, 0.2) 0%,
  transparent 50%,
  rgba(0, 0, 0, 0.9) 100%
);

--gradient-overlay-bottom: linear-gradient(
  to top,
  rgba(0, 0, 0, 0.95) 0%,
  rgba(0, 0, 0, 0.4) 25%,
  transparent 50%
);

/* Glassmorphic Backgrounds */
--gradient-glass: linear-gradient(
  135deg,
  rgba(255, 255, 255, 0.1) 0%,
  rgba(255, 255, 255, 0.05) 100%
);

/* Radial Glows */
--gradient-radial-purple: radial-gradient(
  circle at center,
  rgba(120, 119, 198, 0.35) 0%,
  rgba(32, 31, 60, 0.05) 55%,
  transparent 75%
);
```

---

## 🔤 TYPOGRAPHY

### **Font Family**

```css
--font-primary: -apple-system, BlinkMacSystemFont, 'Segoe UI', 
                'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 
                'Fira Sans', 'Droid Sans', 'Helvetica Neue', 
                sans-serif;

--font-mono: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code',
             'Courier New', monospace;
```

### **Font Sizes**

```css
/* Heading Sizes */
--text-5xl: 3rem;        /* 48px - Hero headings */
--text-4xl: 2.25rem;     /* 36px - Page titles */
--text-3xl: 1.875rem;    /* 30px - Section headers */
--text-2xl: 1.5rem;      /* 24px - Large headings */
--text-xl: 1.25rem;      /* 20px - Subheadings */
--text-lg: 1.125rem;     /* 18px - Large body */

/* Body Sizes */
--text-base: 1rem;       /* 16px - Body text */
--text-sm: 0.875rem;     /* 14px - Small text */
--text-xs: 0.75rem;      /* 12px - Captions */
--text-2xs: 0.625rem;    /* 10px - Labels */
```

### **Font Weights**

```css
--font-weight-light: 300;
--font-weight-normal: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;
--font-weight-extrabold: 800;
```

### **Line Heights**

```css
--leading-tight: 1.25;   /* Headings */
--leading-snug: 1.375;   /* Subheadings */
--leading-normal: 1.5;   /* Body text */
--leading-relaxed: 1.625; /* Large body */
--leading-loose: 2;      /* Spacious text */
```

### **Typography Usage**

```css
/* H1 - Hero / Page Title */
h1 {
  font-size: var(--text-4xl);
  font-weight: var(--font-weight-bold);
  line-height: var(--leading-tight);
  letter-spacing: -0.02em;
}

/* H2 - Section Title */
h2 {
  font-size: var(--text-2xl);
  font-weight: var(--font-weight-bold);
  line-height: var(--leading-tight);
  letter-spacing: -0.01em;
}

/* H3 - Card Title */
h3 {
  font-size: var(--text-xl);
  font-weight: var(--font-weight-semibold);
  line-height: var(--leading-snug);
}

/* Body Text */
p {
  font-size: var(--text-base);
  font-weight: var(--font-weight-normal);
  line-height: var(--leading-normal);
}

/* Small Text / Caption */
.caption {
  font-size: var(--text-sm);
  font-weight: var(--font-weight-normal);
  line-height: var(--leading-normal);
  color: var(--color-white-70);
}

/* Labels */
.label {
  font-size: var(--text-xs);
  font-weight: var(--font-weight-medium);
  line-height: var(--leading-tight);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
```

---

## 📏 SPACING SYSTEM

### **Base Spacing Scale**

```css
--spacing-0: 0;          /* 0px */
--spacing-1: 0.25rem;    /* 4px */
--spacing-2: 0.5rem;     /* 8px */
--spacing-3: 0.75rem;    /* 12px */
--spacing-4: 1rem;       /* 16px */
--spacing-5: 1.25rem;    /* 20px */
--spacing-6: 1.5rem;     /* 24px */
--spacing-8: 2rem;       /* 32px */
--spacing-10: 2.5rem;    /* 40px */
--spacing-12: 3rem;      /* 48px */
--spacing-16: 4rem;      /* 64px */
--spacing-20: 5rem;      /* 80px */
--spacing-24: 6rem;      /* 96px */
```

### **Component Spacing**

```css
/* Card Padding */
--card-padding-sm: var(--spacing-4);   /* 16px */
--card-padding-md: var(--spacing-6);   /* 24px */
--card-padding-lg: var(--spacing-8);   /* 32px */

/* Gap Between Elements */
--gap-xs: var(--spacing-1);  /* 4px */
--gap-sm: var(--spacing-2);  /* 8px */
--gap-md: var(--spacing-4);  /* 16px */
--gap-lg: var(--spacing-6);  /* 24px */
--gap-xl: var(--spacing-8);  /* 32px */

/* Section Spacing */
--section-spacing: var(--spacing-16);  /* 64px */
```

---

## 🔲 BORDER & RADIUS

### **Border Widths**

```css
--border-width-thin: 1px;
--border-width-medium: 2px;
--border-width-thick: 4px;
```

### **Border Radius**

```css
--radius-none: 0;
--radius-sm: 0.375rem;      /* 6px - Small elements */
--radius-md: 0.5rem;        /* 8px - Buttons, inputs */
--radius-lg: 0.75rem;       /* 12px - Cards */
--radius-xl: 1rem;          /* 16px - Large cards */
--radius-2xl: 1.5rem;       /* 24px - Featured cards */
--radius-3xl: 2rem;         /* 32px - Hero elements */
--radius-full: 9999px;      /* Fully rounded - Pills, avatars */
```

### **Usage Examples**

```css
/* Buttons */
.button {
  border-radius: var(--radius-md);
}

/* Cards */
.card {
  border-radius: var(--radius-xl);
}

/* Large Feature Cards */
.feature-card {
  border-radius: var(--radius-3xl);
}

/* Avatar / Pills */
.avatar, .pill {
  border-radius: var(--radius-full);
}
```

---

## 🌫️ SHADOWS & DEPTH

### **Box Shadows**

```css
/* Subtle elevation */
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);

/* Card elevation */
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1),
             0 2px 4px -1px rgba(0, 0, 0, 0.06);

/* Elevated cards */
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1),
             0 4px 6px -2px rgba(0, 0, 0, 0.05);

/* Modal / Floating */
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1),
             0 10px 10px -5px rgba(0, 0, 0, 0.04);

/* Maximum elevation */
--shadow-2xl: 0 25px 50px -12px rgba(0, 0, 0, 0.25);

/* Colored glow effects */
--shadow-glow-yellow: 0 0 20px rgba(255, 204, 0, 0.3);
--shadow-glow-purple: 0 0 20px rgba(139, 92, 246, 0.3);
--shadow-glow-blue: 0 0 20px rgba(59, 130, 246, 0.3);
```

### **Text Shadows**

```css
/* Readable text on images */
--text-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.5);
--text-shadow-md: 0 2px 4px rgba(0, 0, 0, 0.5);
--text-shadow-lg: 0 4px 8px rgba(0, 0, 0, 0.5);
```

---

## ✨ GLASSMORPHISM

### **Glassmorphic Card Style**

```css
.glass-card {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
}

.glass-card-light {
  background: rgba(255, 255, 255, 0.1);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.glass-card-dark {
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(30px);
  -webkit-backdrop-filter: blur(30px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
```

---

## 🎬 ANIMATIONS & TRANSITIONS

### **Transition Durations**

```css
--duration-fast: 150ms;      /* Quick interactions */
--duration-normal: 300ms;    /* Standard transitions */
--duration-slow: 500ms;      /* Complex animations */
--duration-slower: 750ms;    /* Page transitions */
```

### **Easing Functions**

```css
--ease-linear: linear;
--ease-in: cubic-bezier(0.4, 0, 1, 1);
--ease-out: cubic-bezier(0, 0, 0.2, 1);
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1);
--ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55);
--ease-smooth: cubic-bezier(0.2, 0.7, 0.2, 1);
```

### **Common Animations**

```css
/* Fade In */
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Slide Up */
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Scale In */
@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.9);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

/* Pulse */
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

/* Shimmer (Loading) */
@keyframes shimmer {
  0% {
    background-position: -1000px 0;
  }
  100% {
    background-position: 1000px 0;
  }
}
```

### **Hover Effects**

```css
/* Scale on hover */
.hover-scale {
  transition: transform var(--duration-fast) var(--ease-out);
}
.hover-scale:hover {
  transform: scale(1.05);
}

/* Glow on hover */
.hover-glow {
  transition: box-shadow var(--duration-normal) var(--ease-out);
}
.hover-glow:hover {
  box-shadow: var(--shadow-glow-yellow);
}

/* Lift on hover */
.hover-lift {
  transition: transform var(--duration-fast) var(--ease-out),
              box-shadow var(--duration-fast) var(--ease-out);
}
.hover-lift:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-xl);
}
```

---

## 🎯 INTERACTIVE STATES

### **Button States**

```css
/* Default */
.button {
  background: var(--color-yardpass-yellow);
  color: var(--color-black);
  transition: all var(--duration-fast) var(--ease-out);
}

/* Hover */
.button:hover {
  background: var(--color-yardpass-yellow-hover);
  transform: scale(1.02);
}

/* Active / Pressed */
.button:active {
  background: var(--color-yardpass-yellow-active);
  transform: scale(0.98);
}

/* Disabled */
.button:disabled {
  background: var(--color-neutral-800);
  color: var(--color-white-60);
  cursor: not-allowed;
  opacity: 0.5;
}

/* Loading */
.button.loading {
  pointer-events: none;
  opacity: 0.7;
}
```

### **Input States**

```css
/* Default */
.input {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: var(--color-white);
  transition: all var(--duration-fast) var(--ease-out);
}

/* Focus */
.input:focus {
  background: rgba(255, 255, 255, 0.1);
  border-color: var(--color-yardpass-yellow);
  outline: none;
  box-shadow: 0 0 0 3px rgba(255, 204, 0, 0.1);
}

/* Error */
.input.error {
  border-color: var(--color-error);
}

/* Disabled */
.input:disabled {
  background: rgba(255, 255, 255, 0.02);
  color: var(--color-white-60);
  cursor: not-allowed;
}
```

---

## 📱 RESPONSIVE BREAKPOINTS

```css
/* Mobile First Breakpoints */
--breakpoint-sm: 640px;   /* Small devices (phones) */
--breakpoint-md: 768px;   /* Medium devices (tablets) */
--breakpoint-lg: 1024px;  /* Large devices (laptops) */
--breakpoint-xl: 1280px;  /* Extra large (desktops) */
--breakpoint-2xl: 1536px; /* 2X large (large desktops) */
```

### **Usage in Media Queries**

```css
/* Mobile (default) */
.container {
  padding: 1rem;
}

/* Tablet and up */
@media (min-width: 768px) {
  .container {
    padding: 2rem;
  }
}

/* Desktop and up */
@media (min-width: 1024px) {
  .container {
    padding: 3rem;
  }
}
```

---

## 🎭 COMPONENT PATTERNS

### **Card Variants**

```css
/* Basic Card */
.card {
  background: var(--color-neutral-950);
  border-radius: var(--radius-xl);
  padding: var(--card-padding-md);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

/* Elevated Card */
.card-elevated {
  background: var(--color-neutral-900);
  box-shadow: var(--shadow-lg);
}

/* Glassmorphic Card */
.card-glass {
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

/* Interactive Card */
.card-interactive {
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-out);
}
.card-interactive:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-xl);
}
```

### **Button Variants**

```css
/* Primary Button */
.btn-primary {
  background: var(--color-yardpass-yellow);
  color: var(--color-black);
  font-weight: var(--font-weight-semibold);
}

/* Secondary Button */
.btn-secondary {
  background: rgba(255, 255, 255, 0.1);
  color: var(--color-white);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

/* Ghost Button */
.btn-ghost {
  background: transparent;
  color: var(--color-white);
}

/* Destructive Button */
.btn-destructive {
  background: var(--color-error);
  color: var(--color-white);
}

/* Icon Button */
.btn-icon {
  width: 40px;
  height: 40px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-center;
  border-radius: var(--radius-full);
}
```

---

## 🖼️ IMAGE HANDLING

### **Aspect Ratios**

```css
--aspect-square: 1 / 1;      /* 1:1 - Avatars, thumbnails */
--aspect-video: 16 / 9;      /* 16:9 - Video content */
--aspect-portrait: 3 / 4;    /* 3:4 - Portrait images */
--aspect-landscape: 4 / 3;   /* 4:3 - Landscape images */
--aspect-wide: 21 / 9;       /* 21:9 - Ultra-wide */
```

### **Image Loading States**

```css
/* Skeleton loader */
.image-skeleton {
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0.05) 0%,
    rgba(255, 255, 255, 0.1) 50%,
    rgba(255, 255, 255, 0.05) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

/* Lazy loaded image */
.image-lazy {
  opacity: 0;
  transition: opacity var(--duration-normal) var(--ease-out);
}
.image-lazy.loaded {
  opacity: 1;
}
```

---

## 🎨 ICON SYSTEM

### **Icon Sizes**

```css
--icon-xs: 12px;   /* Tiny icons */
--icon-sm: 16px;   /* Small icons */
--icon-md: 20px;   /* Medium icons (default) */
--icon-lg: 24px;   /* Large icons */
--icon-xl: 32px;   /* Extra large icons */
--icon-2xl: 48px;  /* Hero icons */
```

### **Icon Colors**

```css
/* Default icon color */
.icon {
  color: var(--color-white-70);
}

/* Active icon */
.icon-active {
  color: var(--color-yardpass-yellow);
}

/* Muted icon */
.icon-muted {
  color: var(--color-white-50);
}
```

---

## 🔔 NOTIFICATION STYLES

### **Toast Notifications**

```css
/* Success Toast */
.toast-success {
  background: var(--color-success);
  color: white;
  border-left: 4px solid var(--color-success-dark);
}

/* Error Toast */
.toast-error {
  background: var(--color-error);
  color: white;
  border-left: 4px solid var(--color-error-dark);
}

/* Info Toast */
.toast-info {
  background: var(--color-info);
  color: white;
  border-left: 4px solid var(--color-info-dark);
}

/* Warning Toast */
.toast-warning {
  background: var(--color-warning);
  color: var(--color-black);
  border-left: 4px solid var(--color-warning-dark);
}
```

---

## 🎮 INTERACTION FEEDBACK

### **Touch Ripple Effect**

```css
@keyframes ripple {
  to {
    transform: scale(4);
    opacity: 0;
  }
}

.ripple-effect {
  position: relative;
  overflow: hidden;
}

.ripple-effect::after {
  content: '';
  position: absolute;
  width: 100px;
  height: 100px;
  background: rgba(255, 255, 255, 0.5);
  border-radius: 50%;
  transform: scale(0);
  animation: ripple 0.6s ease-out;
}
```

### **Loading Spinners**

```css
/* Circular spinner */
@keyframes spin {
  to { transform: rotate(360deg); }
}

.spinner {
  border: 3px solid rgba(255, 255, 255, 0.1);
  border-top-color: var(--color-yardpass-yellow);
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 0.8s linear infinite;
}
```

---

## 📐 LAYOUT PATTERNS

### **Container Widths**

```css
--container-sm: 640px;   /* Small container */
--container-md: 768px;   /* Medium container */
--container-lg: 1024px;  /* Large container */
--container-xl: 1280px;  /* Extra large */
--container-2xl: 1536px; /* Maximum width */
```

### **Grid System**

```css
/* 12 Column Grid */
.grid-12 {
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  gap: var(--gap-md);
}

/* Responsive Grid */
.grid-responsive {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: var(--gap-lg);
}
```

---

## 🎯 Z-INDEX SCALE

```css
--z-base: 0;           /* Base content */
--z-dropdown: 1000;    /* Dropdowns */
--z-sticky: 1020;      /* Sticky headers */
--z-fixed: 1030;       /* Fixed navigation */
--z-modal-backdrop: 1040;  /* Modal backdrops */
--z-modal: 1050;       /* Modals */
--z-popover: 1060;     /* Popovers */
--z-tooltip: 1070;     /* Tooltips */
--z-notification: 1080; /* Notifications */
--z-max: 9999;         /* Always on top */
```

---

## 🌟 ACCESSIBILITY

### **Focus Styles**

```css
/* Visible focus ring */
*:focus-visible {
  outline: 2px solid var(--color-yardpass-yellow);
  outline-offset: 2px;
}

/* Remove default outline */
*:focus {
  outline: none;
}
```

### **Screen Reader Only**

```css
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border-width: 0;
}
```

---

## 📝 SUMMARY

**This design system provides:**

✅ Consistent color palette with semantic meanings  
✅ Typography scale for all text sizes  
✅ Spacing system for consistent layouts  
✅ Animation & transition standards  
✅ Component patterns & variants  
✅ Responsive breakpoints  
✅ Accessibility considerations  
✅ Icon system  
✅ Shadow & depth hierarchy  
✅ Glassmorphism effects  
✅ Z-index scale for layering  

**Key Files:**
- `src/index.css` - Global styles implementation
- `src/components/ui/*` - Component library
- `tailwind.config.js` - Tailwind configuration

---

**Last Updated:** October 24, 2025  
**Version:** 1.0.0  
**Status:** Complete Global Design System

