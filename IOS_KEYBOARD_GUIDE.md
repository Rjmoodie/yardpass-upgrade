# 📱 iOS Keyboard Handling - Complete Guide

## Overview

iOS keyboard behavior is critical for good UX. This guide covers everything you need to know about keyboard handling in Liventix using Capacitor.

---

## What Was Configured

### 1. ✅ Capacitor Config (`capacitor.config.ts`)

```typescript
Keyboard: {
  resize: 'native',           // Let iOS handle WebView resize
  style: 'dark',              // Dark keyboard appearance
  resizeOnFullScreen: true    // Resize even in fullscreen
}
```

**Resize Modes:**
- **`native`** (Recommended) - iOS automatically adjusts WebView, smooth and reliable
- **`body`** - Capacitor resizes body element (can cause layout shifts)
- **`ionic`** - For Ionic Framework apps
- **`none`** - No automatic resize (manual handling required)

### 2. ✅ Keyboard Hook (`src/hooks/useKeyboard.ts`)

Three hooks for different use cases:

#### `useKeyboard()` - Monitor keyboard state
```typescript
const { isVisible, height, hide, show } = useKeyboard();
```

#### `useKeyboardPadding()` - Auto-adjust padding
```typescript
const style = useKeyboardPadding(20); // 20px extra padding
```

#### `useKeyboardDismiss()` - Dismiss on Enter key
```typescript
const { handleKeyDown } = useKeyboardDismiss();
```

---

## Common Use Cases

### 1. Chat/Comment Input (Bottom of Screen)

**Problem:** Keyboard covers input field

**Solution:** Dynamic padding

```typescript
import { useKeyboard } from '@/hooks/useKeyboard';

const ChatInput = () => {
  const { isVisible, height } = useKeyboard();

  return (
    <div 
      className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 transition-all duration-200"
      style={{
        paddingBottom: isVisible ? height + 16 : 16
      }}
    >
      <input 
        type="text" 
        placeholder="Type a message..."
        className="w-full"
      />
    </div>
  );
};
```

### 2. Post Creator (Modal with Textarea)

**Problem:** Keyboard covers textarea, can't see what you're typing

**Solution:** Use `useKeyboardPadding()` hook

```typescript
import { useKeyboardPadding } from '@/hooks/useKeyboard';

const PostCreatorModal = () => {
  const keyboardPadding = useKeyboardPadding(20); // 20px buffer

  return (
    <Dialog>
      <DialogContent>
        <div style={keyboardPadding}>
          <Textarea 
            placeholder="What's happening?"
            rows={6}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};
```

### 3. Search Bar (Dismiss on Enter)

**Problem:** No way to dismiss keyboard after typing

**Solution:** Use `useKeyboardDismiss()` hook

```typescript
import { useKeyboardDismiss } from '@/hooks/useKeyboard';

const SearchBar = () => {
  const { handleKeyDown } = useKeyboardDismiss();
  const [query, setQuery] = useState('');

  const handleSearch = () => {
    // Search logic
    console.log('Searching for:', query);
  };

  return (
    <input
      type="text"
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      onKeyDown={(e) => {
        handleKeyDown(e);
        if (e.key === 'Enter') handleSearch();
      }}
      placeholder="Search events..."
    />
  );
};
```

### 4. Form with Multiple Inputs

**Problem:** Keyboard covers next field when tabbing

**Solution:** Combine `useKeyboard()` with auto-scroll

```typescript
import { useKeyboard } from '@/hooks/useKeyboard';
import { useEffect, useRef } from 'react';

const EventForm = () => {
  const { isVisible, height } = useKeyboard();
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to active input when keyboard appears
  useEffect(() => {
    if (!isVisible) return;

    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement) {
      activeElement.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [isVisible]);

  return (
    <div 
      ref={containerRef}
      style={{ paddingBottom: isVisible ? height + 40 : 40 }}
    >
      <input name="title" placeholder="Event Title" />
      <input name="venue" placeholder="Venue" />
      <input name="city" placeholder="City" />
      <textarea name="description" placeholder="Description" />
    </div>
  );
};
```

### 5. Custom Keyboard Toolbar (iOS Style)

**Problem:** Need "Done" button above keyboard

**Solution:** Render toolbar when keyboard is visible

```typescript
import { useKeyboard } from '@/hooks/useKeyboard';

const CommentInput = () => {
  const { isVisible, height, hide } = useKeyboard();
  const [comment, setComment] = useState('');

  const handlePost = () => {
    // Post comment logic
    console.log('Posting:', comment);
    setComment('');
    hide();
  };

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0">
        {/* Custom toolbar above keyboard */}
        {isVisible && (
          <div 
            className="bg-muted border-t px-4 py-2 flex justify-between items-center"
            style={{ bottom: height }}
          >
            <span className="text-sm text-muted-foreground">
              {comment.length}/500
            </span>
            <Button size="sm" onClick={handlePost}>
              Post
            </Button>
          </div>
        )}

        {/* Input field */}
        <div 
          className="bg-background border-t p-4"
          style={{ paddingBottom: isVisible ? height + 16 : 16 }}
        >
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add a comment..."
            rows={3}
            maxLength={500}
          />
        </div>
      </div>
    </>
  );
};
```

---

## iOS-Specific Keyboard Features

### 1. Keyboard Appearance (Light/Dark)

Set in `capacitor.config.ts`:

```typescript
Keyboard: {
  style: 'dark'  // or 'light'
}
```

**Dynamic (based on theme):**

```typescript
import { Keyboard } from '@capacitor/keyboard';
import { useTheme } from 'next-themes';

const App = () => {
  const { theme } = useTheme();

  useEffect(() => {
    if (Capacitor.isNativePlatform()) {
      Keyboard.setStyle({ 
        style: theme === 'dark' ? 'dark' : 'light' 
      });
    }
  }, [theme]);
};
```

### 2. Keyboard Accessory Bar

iOS shows a toolbar above the keyboard with "Previous", "Next", "Done".

**To customize:** Use native Swift code (advanced) or use the custom toolbar approach from Example #5 above.

### 3. Return Key Type

Control what the return key says:

```typescript
<input
  type="text"
  enterKeyHint="search"  // Shows "Search" on iOS keyboard
/>

<input
  type="text"
  enterKeyHint="done"    // Shows "Done"
/>

<input
  type="text"
  enterKeyHint="go"      // Shows "Go"
/>

<input
  type="text"
  enterKeyHint="next"    // Shows "Next"
/>

<input
  type="text"
  enterKeyHint="send"    // Shows "Send"
/>
```

### 4. Input Types & iOS Keyboards

Different `inputMode` values trigger different keyboards:

```typescript
// Numeric keyboard (phone pad)
<input type="tel" inputMode="tel" placeholder="Phone" />

// Decimal keyboard (with . and ,)
<input type="number" inputMode="decimal" placeholder="Price" />

// Email keyboard (with @)
<input type="email" inputMode="email" placeholder="Email" />

// URL keyboard (with .com)
<input type="url" inputMode="url" placeholder="Website" />

// Search keyboard (with Search button)
<input type="search" inputMode="search" placeholder="Search" />
```

---

## Best Practices

### ✅ DO:

1. **Use `resize: 'native'`** - Most reliable, let iOS handle it
2. **Test on real device** - Keyboard behavior differs on simulator
3. **Add padding to bottom elements** - Use `useKeyboardPadding()`
4. **Dismiss keyboard explicitly** - Provide "Done" button or gesture
5. **Use correct `inputMode`** - Show appropriate keyboard for data type
6. **Prevent auto-zoom** - Set `font-size: 16px` minimum on inputs
7. **Handle orientation changes** - Keyboard height changes in landscape

### ❌ DON'T:

1. **Don't use `resize: 'none'`** unless you have custom handling
2. **Don't forget safe area** - Account for notch/home indicator
3. **Don't block submit on Enter** - Let users submit forms easily
4. **Don't auto-focus on page load** - Keyboard popping up is jarring
5. **Don't ignore keyboard visibility** - Update UI accordingly
6. **Don't use small fonts** - iOS will auto-zoom, causing layout shifts
7. **Don't nest scrollable areas** - Causes scroll fighting with keyboard

---

## Troubleshooting

### Issue: Input is covered by keyboard

**Fix:** Add dynamic padding

```typescript
const { isVisible, height } = useKeyboard();
<div style={{ paddingBottom: isVisible ? height : 0 }}>
```

### Issue: Keyboard doesn't dismiss

**Fix:** Add explicit dismiss button

```typescript
const { hide } = useKeyboard();
<Button onClick={hide}>Done</Button>
```

### Issue: Layout jumps when keyboard appears

**Fix:** Use `transition` for smooth animation

```typescript
<div 
  style={{ 
    paddingBottom: isVisible ? height : 0,
    transition: 'padding-bottom 0.2s ease-out'
  }}
>
```

### Issue: Can't see active input field

**Fix:** Auto-scroll to input

```typescript
useEffect(() => {
  if (isVisible) {
    document.activeElement?.scrollIntoView({
      behavior: 'smooth',
      block: 'center'
    });
  }
}, [isVisible]);
```

### Issue: iOS auto-zooms on input focus

**Fix:** Set minimum font size to 16px

```css
input, textarea, select {
  font-size: 16px !important;
}
```

### Issue: Keyboard covers modal footer buttons

**Fix:** Use `useKeyboardPadding()` on modal content

```typescript
const PostModal = () => {
  const keyboardPadding = useKeyboardPadding(20);
  
  return (
    <Dialog>
      <DialogContent>
        <div style={keyboardPadding}>
          {/* Content */}
        </div>
        <DialogFooter>
          <Button>Submit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
```

---

## Testing Checklist

### On Real iPhone:

- [ ] Keyboard appears when tapping input
- [ ] Keyboard doesn't cover input field
- [ ] Can scroll to see all inputs
- [ ] "Done" button dismisses keyboard
- [ ] Return key submits form (if appropriate)
- [ ] Correct keyboard type appears (numeric, email, etc.)
- [ ] Keyboard appearance matches app theme (dark/light)
- [ ] Layout doesn't jump when keyboard appears
- [ ] Can dismiss keyboard by tapping outside
- [ ] Landscape orientation works correctly
- [ ] Safe area is respected (notch/home indicator)
- [ ] No auto-zoom on input focus

---

## Example: PostCreatorModal with Keyboard Handling

```typescript
import { useKeyboard, useKeyboardPadding } from '@/hooks/useKeyboard';

const PostCreatorModal = ({ isOpen, onClose }) => {
  const { isVisible, hide } = useKeyboard();
  const keyboardPadding = useKeyboardPadding(80); // 80px for footer
  const [content, setContent] = useState('');

  const handlePost = async () => {
    // Post logic
    await createPost(content);
    hide(); // Dismiss keyboard
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>New Post</DialogTitle>
        </DialogHeader>

        {/* Content area with keyboard padding */}
        <div 
          className="flex-1 overflow-auto"
          style={keyboardPadding}
        >
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Share photos, videos, or updates related to your event"
            rows={6}
            enterKeyHint="done"
            className="text-base" // Prevent auto-zoom
          />
        </div>

        {/* Footer (stays visible above keyboard) */}
        <DialogFooter 
          className="border-t pt-4"
          style={{
            position: isVisible ? 'fixed' : 'relative',
            bottom: isVisible ? height : 0,
            left: 0,
            right: 0,
            background: 'var(--background)',
            padding: '1rem'
          }}
        >
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handlePost} disabled={!content.trim()}>
            Post
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
```

---

## Resources

- **Capacitor Keyboard Docs:** https://capacitorjs.com/docs/apis/keyboard
- **iOS Human Interface Guidelines:** https://developer.apple.com/design/human-interface-guidelines/keyboards
- **Web Input Types:** https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input#input_types

---

## Summary

✅ **Hook created:** `src/hooks/useKeyboard.ts`  
✅ **Config updated:** `capacitor.config.ts`  
✅ **Best practices:** Documented above  
✅ **Examples:** 5 common use cases covered  

**Next:** Apply `useKeyboardPadding()` to your PostCreatorModal and other forms!





