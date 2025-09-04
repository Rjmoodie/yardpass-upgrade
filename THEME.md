# Mango Sand Theme System

This project uses the "Mango Sand" theme system - a sophisticated, neutral design with pops of optimistic orange for actions.

## Color Tokens

### Light Mode
- **Background/Surfaces**: `#F7F7F5`, `#FFFFFF`, `#F2F2EE`
- **Text**: `#0F1115` (primary), `#525866` (secondary), `#6B7280` (muted)
- **Accent**: `#F05537` (primary), `#D7462E` (hover), `#FFD7CC` (subtle)
- **Border**: `#E6E6E3`

### Dark Mode  
- **Background/Surfaces**: `#0F1115`, `#151821`, `#1C2030`
- **Text**: `#FFFFFF` (primary), `#B8BDCB` (secondary), `#8C92A4` (muted)
- **Border**: `#2A2F40`

### Support Colors
- **Success**: `#22C55E`
- **Warning**: `#F59E0B` 
- **Error**: `#EF4444`
- **Info**: `#3B82F6`

## Usage

### CSS Variables
```css
/* Use semantic tokens */
background: hsl(var(--bg));
color: hsl(var(--text));
border: 1px solid hsl(var(--border));
```

### Tailwind Classes
```jsx
<div className="bg-bg text-text border border-border">
  <button className="bg-accent text-white hover:bg-accent-600">
    Action
  </button>
</div>
```

### Component Classes
```jsx
/* Pre-styled component classes */
<button className="btn-primary">Primary Button</button>
<div className="card">Card Content</div>
<span className="pill">Badge</span>
<div className="action-rail">Floating Actions</div>
```

## Typography

- **Display**: 28px/34px/700
- **H1**: 24px/30px/700  
- **H2**: 20px/26px/700
- **Body**: 16px/24px/500
- **Caption**: 13px/18px/500

Use `.font-tabular` for prices and stats to ensure consistent number alignment.

## Components

- **Buttons**: 12px radius, solid primary uses accent color
- **Cards**: 12-16px radius, subtle shadows
- **Pills/Badges**: Full radius, accent-200 background
- **Focus rings**: 2px accent color with offset

## Theme Toggle

The `ThemeToggle` component allows users to switch between light and dark modes. Theme preference is saved to localStorage.

## Accessibility

- Maintains 4.5:1 contrast ratio for text readability
- Focus rings visible on all interactive elements
- All icon buttons include proper aria-labels
- Keyboard navigation fully supported