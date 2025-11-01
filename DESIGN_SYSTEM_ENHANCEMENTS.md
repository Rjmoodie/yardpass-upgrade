# 🎨 Design System Enhancements

> **Applied**: Visual clarity, contrast, focus states, glass/elevation, and on-image legibility improvements
> 
> **Performance**: All enhancements are additive and maintain iOS performance optimizations

---

## 🆕 What's New

### ✨ Enhanced Visual Quality
- **Better color contrast** - `brand.foreground` for high-contrast text on brand backgrounds
- **Refined shadows** - `shadow-card`, `shadow-elevated`, `shadow-elevated2`
- **Glass effects** - `.glass` and `.glass-strong` with blur/saturate/brightness
- **On-image overlays** - `.overlay-soft` and `.overlay-strong` for legible text on images
- **Text shadows** - `.on-image` and `.on-image-strong` for always-visible text
- **Focus rings** - High-contrast, offset focus states that never get lost

### 🎯 New Design Tokens

#### Colors
```tsx
// Brand with contrast-friendly foreground
<div className="bg-brand-500 text-brand-foreground">High contrast!</div>

// Neutral system (0-900)
<div className="bg-neutral-800 text-neutral-0">Dark mode ready</div>

// Semantic colors
<span className="text-success">Success</span>
<span className="text-warning">Warning</span>
<span className="text-danger">Danger</span>
```

#### Glass & Elevation
```tsx
// Glass blur effects
<div className="glass rounded-3xl p-5">
  Glassmorphism with blur + saturate
</div>

<div className="glass-strong rounded-3xl p-5">
  Stronger glass effect
</div>

// Elevated cards
<div className="elevated-card p-6">
  Premium card with shadow + ring
</div>
```

#### Backdrop Effects
```tsx
// New backdrop utilities
<div className="backdrop-blur-glass backdrop-saturate-125 backdrop-brightness-90">
  Custom glass effect
</div>
```

---

## 📚 Usage Examples

### 1️⃣ On-Image Text Legibility

**Before** (text might disappear on light backgrounds):
```tsx
<div className="relative">
  <img src={event.image} />
  <div className="absolute bottom-0 p-4">
    <h3 className="text-white">{title}</h3>
  </div>
</div>
```

**After** (always visible):
```tsx
<div className="relative overlay-strong">
  <img src={event.image} />
  <div className="absolute bottom-0 p-4 on-image">
    <h3 className="text-white font-bold drop-shadow">{title}</h3>
    <p className="text-white/85">{description}</p>
  </div>
</div>
```

### 2️⃣ Premium CTA Buttons

**Before**:
```tsx
<button className="bg-brand-500 text-white px-4 py-2 rounded-lg">
  Get Tickets
</button>
```

**After** (with gradient, better focus, shadow):
```tsx
<button className="btn-primary shadow-card hover:shadow-elevated2">
  Get Tickets
</button>
```

### 3️⃣ Glass Cards on Images

**Perfect for floating UI over images/videos**:
```tsx
<div className="glass-strong rounded-3xl p-5 shadow-elevated">
  <h4 className="font-semibold">Ticket Info</h4>
  <p className="text-sm opacity-85">Starting at $25</p>
</div>
```

### 4️⃣ Chips & Tags

```tsx
// Neutral chip
<span className="chip">General Admission</span>

// Brand chip
<span className="chip-amber">VIP</span>

// Custom chip
<span className="chip bg-success/10 text-success border-success/20">
  Available
</span>
```

---

## 🎨 Pre-built Component Classes

### `.glass`
Glassmorphism effect with backdrop blur + saturate + brightness
- `backdrop-blur-glass` (20px)
- `backdrop-saturate-125`
- `backdrop-brightness-90`
- `bg-white/10 dark:bg-neutral-900/30`
- `border border-white/15`

### `.glass-strong`
Stronger glass effect for more prominent UI elements

### `.elevated-card`
Premium card with shadow + ring
- `rounded-xl`
- `shadow-elevated`
- `bg-neutral-0/95 dark:bg-neutral-800/85`
- `ring-1 ring-neutral-200/60`

### `.btn-primary`
Primary CTA button with gradient + focus ring
- Gradient: `from-brand-500 to-brand-600`
- Hover: `from-brand-400 to-brand-600`
- Focus: High-contrast brand ring with offset

### `.on-image` / `.on-image-strong`
Text shadows for legibility on images

### `.overlay-soft` / `.overlay-strong`
Gradient overlays (auto `::before` pseudo-element)

---

## 🔧 Enhanced Tokens

### Shadows
```tsx
shadow-subtle    // Soft card shadow
shadow-card      // Standard card shadow
shadow-elevated  // Elevated card shadow
shadow-elevated2 // Strong elevation
shadow-focus     // Brand focus ring
shadow-brand     // Brand focus ring
```

### Border Radius
```tsx
rounded-xs       // 4px
rounded-sm       // 6px
rounded-md       // 12px
rounded-lg       // 16px
rounded-xl       // 20px
rounded-pill     // 9999px (full pill)
```

### Typography
All font sizes now include optimized `lineHeight` and `letterSpacing`:
```tsx
text-xs   // 12px with 1rem line-height
text-sm   // 14px with 1.25rem line-height
text-base // 16px with 1.5rem line-height
text-lg   // 18px with 1.75rem line-height
text-xl   // 20px with 1.75rem line-height, -0.015em tracking
text-2xl  // 22px with 2rem line-height, -0.02em tracking
text-3xl  // 24px with 2rem line-height, -0.02em tracking
text-4xl  // 30px with 2.25rem line-height, -0.02em tracking
text-5xl  // 36px with 2.5rem line-height, -0.025em tracking
```

### Ring Widths & Offsets
```tsx
ring-3         // 3px ring
ring-offset-2  // 2px offset
ring-offset-3  // 3px offset
```

### Opacity
```tsx
opacity-15  // 0.15
opacity-85  // 0.85
opacity-95  // 0.95
```

---

## 🎭 Dark Mode

Supports both:
- `.dark` class (default)
- `[data-theme="dark"]` attribute

All glass, elevated, and neutral components are dark-mode ready!

---

## 🚀 Performance Notes

✅ **Maintained**:
- Touch action optimization (`touch-action: manipulation`)
- Tap highlight removal (`-webkit-tap-highlight-color: transparent`)
- Feed virtualization (`content-visibility: auto`)
- iOS viewport handling (`100svh`, safe areas)
- Reduced motion support (`prefers-reduced-motion`)

✅ **Added**:
- Smooth scrollbar styling (subtle, performant)
- Smart focus rings (only on keyboard navigation)
- Optimized transitions (iOS cubic-bezier easing)
- Selection styling (branded, accessible)

---

## 📦 Optional Plugins

To enable typography and form utilities, install:

```bash
npm install -D @tailwindcss/typography @tailwindcss/forms
```

Then uncomment in `tailwind.config.ts`:
```ts
plugins: [
  require("tailwindcss-animate"),
  require("@tailwindcss/typography"),  // ← Uncomment
  require("@tailwindcss/forms"),       // ← Uncomment
],
```

---

## 🎯 Quick Wins

### 1. Feed Cards
```tsx
<div className="feed-card overlay-strong">
  <img src={media} />
  <div className="absolute bottom-0 p-4 on-image">
    <h3 className="text-white font-bold">{title}</h3>
  </div>
</div>
```

### 2. Event Cards
```tsx
<div className="elevated-card p-6 space-y-4">
  <img src={poster} className="rounded-lg" />
  <h3 className="text-lg font-semibold">{event}</h3>
  <button className="btn-primary w-full">Get Tickets</button>
</div>
```

### 3. Floating UI
```tsx
<div className="glass-strong rounded-2xl p-4 shadow-elevated">
  <p className="text-sm font-medium">Now Playing</p>
</div>
```

---

## 🆚 Before/After

### Text on Images
**Before**: Text disappears on light areas
**After**: `.overlay-strong + .on-image` = always visible ✅

### Focus States
**Before**: Thin blue outline, easy to miss
**After**: High-contrast brand ring with white offset ✅

### Cards
**Before**: Flat, no depth
**After**: `.elevated-card` with shadow + ring = premium feel ✅

### Glass UI
**Before**: Manual blur/saturate/brightness
**After**: `.glass` or `.glass-strong` = instant ✅

---

## 💡 Tips

1. **Use `.overlay-strong` on all event/media cards** - guarantees text legibility
2. **Use `.glass-strong` for floating UI over videos** - maintains readability
3. **Use `.btn-primary` for all primary CTAs** - consistent brand experience
4. **Use `.elevated-card` instead of manual shadow classes** - better hierarchy
5. **Use `text-brand-foreground` on brand backgrounds** - perfect contrast

---

**Result**: Premium visual quality + perfect accessibility + zero performance cost! 🎉

