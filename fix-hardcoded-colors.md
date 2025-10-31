# Fix Hardcoded Colors - Replace with Theme Variables

## Files with Hardcoded #FF8C00

All pages in `src/pages/new-design/` have hardcoded colors that need to be replaced:

1. SearchPage.tsx - 6 instances
2. TicketsPage.tsx - Multiple instances
3. MessagesPage.tsx - Multiple instances
4. ProfilePage.tsx - Multiple instances
5. EventDetailsPage.tsx - Multiple instances
6. NotificationsPage.tsx - Multiple instances
7. FeedPageComplete.tsx - Multiple instances

---

## Replacement Rules

### Background Colors
```tsx
// Before
bg-[#FF8C00]
bg-[#FF9D1A]  // Hover variant

// After
bg-primary
bg-primary/90  // Hover variant (or use hover:bg-primary/90)
```

### Text Colors
```tsx
// Before
text-[#FF8C00]

// After
text-primary
```

### Border Colors
```tsx
// Before
border-[#FF8C00]

// After
border-primary
```

### Focus States
```tsx
// Before
focus:border-[#FF8C00]

// After
focus:border-primary
```

### Combined Classes
```tsx
// Before
bg-[#FF8C00] text-white hover:bg-[#FF9D1A]

// After
bg-primary text-primary-foreground hover:bg-primary/90
```

---

## Why This Is Critical

1. **Consistency**: Theme variables ensure ONE source of truth
2. **Theming**: Works in custom themes (if you add them)
3. **Maintenance**: Change color once, updates everywhere
4. **Color Accuracy**: CSS variables use hsl(33 100% 50%) = exact #FF8C00

---

## Automated Fix Needed

Need to replace across 7 files:
- `src/pages/new-design/SearchPage.tsx`
- `src/pages/new-design/TicketsPage.tsx`
- `src/pages/new-design/MessagesPage.tsx`
- `src/pages/new-design/ProfilePage.tsx`
- `src/pages/new-design/EventDetailsPage.tsx`
- `src/pages/new-design/NotificationsPage.tsx`
- `src/pages/new-design/FeedPageComplete.tsx`

Estimated: ~50-100 replacements total


