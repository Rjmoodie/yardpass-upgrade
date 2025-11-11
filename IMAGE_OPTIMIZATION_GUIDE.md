# 🖼️ YardPass Image Optimization Guide
**Generated:** November 9, 2025  
**Status:** 111 issues found (1 critical, 6 warnings, 104 optimizations)

---

## 🚨 Critical Issues (Fix Immediately)

### 1. Very Large PNG File (1067 KB)

**File:** `public/lovable-uploads/247f3ae4-8789-4a73-af97-f0e41767873a.png`  
**Size:** 1067 KB (1024×1024px)  
**Impact:** Slows page load by ~2-3 seconds on 3G

**Solution:**
```bash
# Option A: Compress with squoosh.app (manual)
# 1. Visit https://squoosh.app
# 2. Upload the PNG
# 3. Select "MozJPEG" or "WebP"
# 4. Set quality to 80-85
# 5. Download (should be ~150-200 KB)

# Option B: Use ImageMagick (automated)
convert public/lovable-uploads/247f3ae4-8789-4a73-af97-f0e41767873a.png \
  -quality 85 \
  -resize 1024x1024 \
  public/lovable-uploads/247f3ae4-8789-4a73-af97-f0e41767873a.jpg

# Option C: Create WebP version
convert public/lovable-uploads/247f3ae4-8789-4a73-af97-f0e41767873a.png \
  -quality 85 \
  public/lovable-uploads/247f3ae4-8789-4a73-af97-f0e41767873a.webp
```

**Expected Result:** 1067 KB → 150-200 KB (80-85% reduction)

---

## ⚠️ Warnings (Address Soon)

### Missing WebP Alternatives (6 files)

| File | Current Size | Est. WebP Size | Savings |
|------|--------------|----------------|---------|
| `public/images/placeholders/event-cover-fallback.jpg` | 93 KB | ~60 KB | 35% |
| `public/images/yardpass-logo-full.png` | Various | Various | 25-35% |
| `public/lovable-uploads/*.png` | Various | Various | 25-35% |

**Why WebP?**
- 25-35% smaller than JPEG/PNG
- Supported by 96%+ of browsers
- Better compression without quality loss

**Implementation:**

```typescript
// Use <picture> element for WebP + fallback
<picture>
  <source srcSet="/images/hero.webp" type="image/webp" />
  <source srcSet="/images/hero.jpg" type="image/jpeg" />
  <img src="/images/hero.jpg" alt="Hero" loading="lazy" />
</picture>
```

Or create a reusable component:

```typescript
// src/components/OptimizedImage.tsx
interface OptimizedImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  loading?: 'lazy' | 'eager';
  className?: string;
}

export function OptimizedImage({ 
  src, 
  alt, 
  width, 
  height, 
  loading = 'lazy',
  className 
}: OptimizedImageProps) {
  // Auto-generate WebP path
  const webpSrc = src.replace(/\.(jpe?g|png)$/i, '.webp');
  
  return (
    <picture>
      <source srcSet={webpSrc} type="image/webp" />
      <img 
        src={src} 
        alt={alt}
        width={width}
        height={height}
        loading={loading}
        className={className}
      />
    </picture>
  );
}
```

---

## ℹ️ Optimizations (Improve Performance)

### 1. Missing Lazy Loading (48 occurrences)

**Impact:** Initial page load includes below-fold images  
**Solution:** Add `loading="lazy"` attribute

**Examples:**
```typescript
// ❌ Bad: Loads immediately
<img src="/profile.jpg" alt="Profile" />

// ✅ Good: Defers loading until near viewport
<img src="/profile.jpg" alt="Profile" loading="lazy" />

// ✅ Better: Lazy + dimensions
<img 
  src="/profile.jpg" 
  alt="Profile" 
  width={200} 
  height={200} 
  loading="lazy" 
/>
```

**Files to Update (top 10):**
1. `src/components/AuthScreen.tsx:137`
2. `src/components/BrandedSpinner.tsx:35`
3. `src/components/CommentModal.tsx:1284`
4. `src/components/EventCard.tsx` (multiple)
5. `src/components/ProfileCard.tsx` (multiple)
6. `src/components/feed/EventMedia.tsx` (multiple)
7. ... and 42 more

### 2. Missing Dimensions (56 occurrences)

**Impact:** Causes Cumulative Layout Shift (CLS) - bad for Core Web Vitals  
**Solution:** Add `width` and `height` attributes

**Why it matters:**
- Prevents layout jumping when images load
- Improves Core Web Vitals score
- Better user experience

**Examples:**
```typescript
// ❌ Bad: Browser doesn't know size until image loads
<img src="/banner.jpg" alt="Banner" />

// ✅ Good: Browser reserves space immediately
<img 
  src="/banner.jpg" 
  alt="Banner" 
  width={1200} 
  height={600} 
/>

// ✅ Best: Responsive with aspect-ratio
<img 
  src="/banner.jpg" 
  alt="Banner" 
  width={1200} 
  height={600}
  style={{ width: '100%', height: 'auto' }}
/>
```

---

## 🎯 Quick Wins (Do These First)

### Priority 1: Compress the 1MB PNG ⚠️

**Impact:** 2-3 second load time improvement  
**Effort:** 5 minutes  
**Files:** 1

```bash
# Download and use squoosh.app
# Target: <200 KB
```

### Priority 2: Add Lazy Loading to Event Cards

**Impact:** 30-40% faster initial load  
**Effort:** 10 minutes  
**Files:** 5-10

```typescript
// Find all event card images and add loading="lazy"
<img 
  src={event.cover_image} 
  alt={event.title}
  loading="lazy"  // ← Add this
/>
```

### Priority 3: Add Dimensions to Profile Images

**Impact:** Eliminates layout shift  
**Effort:** 15 minutes  
**Files:** 10-15

```typescript
// Standard profile image: 200x200
<img 
  src={user.avatar} 
  alt={user.name}
  width={200}
  height={200}
  loading="lazy"
/>
```

### Priority 4: Create WebP Versions of Static Assets

**Impact:** 25-35% smaller images  
**Effort:** 20 minutes  
**Files:** 6

```bash
# Batch convert with ImageMagick or squoosh.app
for file in public/images/*.{jpg,png}; do
  cwebp "$file" -o "${file%.*}.webp" -q 85
done
```

---

## 🔧 Automated Solutions

### Option A: Build-Time Optimization (Recommended)

Install `vite-plugin-image-optimizer`:

```bash
npm install --save-dev vite-plugin-image-optimizer
```

```typescript
// vite.config.ts
import { ViteImageOptimizer } from 'vite-plugin-image-optimizer';

export default defineConfig({
  plugins: [
    ViteImageOptimizer({
      jpg: { quality: 85 },
      png: { quality: 85 },
      webp: { quality: 85 },
    }),
  ],
});
```

**Result:** All images auto-compressed during build

### Option B: CDN with Auto-Optimization

Use Cloudinary, Imgix, or CloudFlare Images:

```typescript
// utils/imageUrl.ts
export function optimizedImageUrl(
  url: string,
  { width, height, format = 'auto', quality = 85 }
) {
  // Example for Cloudinary
  return `https://res.cloudinary.com/yardpass/image/upload/w_${width},h_${height},q_${quality},f_${format}/${url}`;
}

// Usage
<img 
  src={optimizedImageUrl(event.cover, { width: 600, height: 400 })}
  alt={event.title}
  loading="lazy"
/>
```

**Benefits:**
- Auto-format (WebP for modern browsers, JPEG for old ones)
- Auto-resize based on device
- Auto-compress
- Global CDN delivery

### Option C: Next.js Image Component (If Migrating)

```typescript
import Image from 'next/image';

<Image
  src="/event-cover.jpg"
  alt="Event"
  width={600}
  height={400}
  loading="lazy"
  placeholder="blur"
/>
// Auto-optimizes, lazy loads, and prevents CLS
```

---

## 📊 Expected Performance Improvements

| Optimization | Impact | Effort | Priority |
|--------------|--------|--------|----------|
| Compress 1MB PNG | -800 KB, -2s load | 5 min | 🔴 Critical |
| Add lazy loading (48 imgs) | -300 KB initial | 30 min | 🟡 High |
| Create WebP versions | -150 KB total | 20 min | 🟡 High |
| Add dimensions (56 imgs) | 0 CLS, +10 Lighthouse | 45 min | 🟢 Medium |

**Total Impact:** ~1.2 MB reduction, 2-3 seconds faster load

---

## 🚀 Implementation Plan

### Week 1: Critical Fixes
- [ ] Compress the 1MB PNG file
- [ ] Add lazy loading to all event card images
- [ ] Add lazy loading to profile images

### Week 2: WebP Migration
- [ ] Create `OptimizedImage` component
- [ ] Generate WebP versions of static assets
- [ ] Replace `<img>` with `<OptimizedImage>` in key components

### Week 3: Dimensions & CLS
- [ ] Add width/height to all images
- [ ] Test with Lighthouse for CLS improvement
- [ ] Document standard image sizes

### Future: Automation
- [ ] Evaluate Cloudinary vs Imgix vs CloudFlare Images
- [ ] Implement CDN with auto-optimization
- [ ] Add image upload validation (max size, auto-compress)

---

## 📈 Monitoring

### Track These Metrics:

**Before optimization:**
- Total image size: 1292 KB
- Largest image: 1067 KB
- Images without lazy loading: 48
- Images without dimensions: 56

**Target (after optimization):**
- Total image size: <500 KB
- Largest image: <200 KB
- Images without lazy loading: 0
- Images without dimensions: 0
- Lighthouse Performance: >90
- CLS score: <0.1

### PostHog Tracking:

```typescript
// Track image load performance
const img = new Image();
img.onload = () => {
  posthog.capture('image_loaded', {
    url: img.src,
    width: img.naturalWidth,
    height: img.naturalHeight,
    load_time_ms: performance.now() - startTime,
  });
};
```

---

## 💡 Best Practices Going Forward

### For Developers:

1. **Always use lazy loading** (unless above-the-fold)
2. **Always include width/height** (prevents CLS)
3. **Compress before committing** (use squoosh.app)
4. **Provide WebP alternatives** (for 25-35% savings)
5. **Use descriptive alt text** (accessibility + SEO)

### For Designers:

1. **Export at 2x for Retina** (but compress aggressively)
2. **Use JPEG for photos**, PNG for logos/icons
3. **Target <100 KB per image** (<50 KB for thumbnails)
4. **Provide multiple sizes** (thumbnail, medium, large)

### For Content Editors:

1. **Compress uploads** (use built-in tools)
2. **Check file size before upload** (<500 KB max)
3. **Use appropriate dimensions** (don't upload 4K for 400px display)
4. **Add descriptive alt text** (for accessibility)

---

## 🔗 Resources

- **Squoosh.app** - https://squoosh.app (free image compression)
- **ImageMagick** - https://imagemagick.org (CLI tool)
- **WebP Converter** - https://developers.google.com/speed/webp
- **Lighthouse** - Chrome DevTools → Lighthouse tab
- **Core Web Vitals** - https://web.dev/vitals

---

**Questions? Run:** `node scripts/audit-images.js` to re-scan

**Next Steps:** Start with Priority 1 (compress 1MB PNG) → immediate 2s improvement! 🚀

