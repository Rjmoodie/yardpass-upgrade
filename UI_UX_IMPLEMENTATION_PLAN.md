# YardPass UI/UX Implementation Plan

## 🎯 **Overview**
This document outlines the systematic implementation plan to address all UI/UX issues identified in the comprehensive review.

---

## **Phase 1: Global Scrolling & Safe Area Fixes**

### **Files to Modify:**
- `src/index.css` - Global scrolling fixes
- `src/App.tsx` - Root layout adjustments  
- `src/components/Navigation.tsx` - Bottom nav safe area

### **Implementation:**

#### **Global Scrolling Fixes (src/index.css):**
```css
/* Global scrolling fixes */
html, body, #root {
  height: 100dvh;
  overflow: hidden;
  -webkit-overflow-scrolling: touch;
}

/* Ensure all scrollable areas have proper touch scrolling */
.scroll-container {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}

/* Safe area for all fixed elements */
.fixed-element {
  padding-bottom: env(safe-area-inset-bottom);
  padding-top: env(safe-area-inset-top);
}

/* Universal scrolling fix for all main content */
.app-surface-content,
.content-on-nav > *,
.main-content-with-nav {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
}
```

#### **App.tsx Updates:**
```tsx
// Ensure proper scroll containers
<div className="app-frame flex min-h-dvh flex-col bg-background relative no-page-bounce">
  <div className="app-mesh pointer-events-none" aria-hidden="true" />
  <main className="content-on-nav scroll-container" role="main" aria-label="Main content">
    {/* Content */}
  </main>
</div>
```

---

## **Phase 2: Feed Page Improvements**

### **Files to Modify:**
- `src/components/UnifiedFeedList.tsx` - Fix "Near near me" duplication
- `src/components/SearchPage.tsx` - Filter functionality
- `src/components/feed/FeedActionRail.tsx` - Button positioning
- `src/components/feed/FeedCaption.tsx` - Caption spacing

### **Implementation:**

#### **Fix "Near near me" Duplication:**
```tsx
// In UnifiedFeedList.tsx
<h1 className="text-sm font-semibold leading-tight text-white sm:text-base">
  Near {activeLocation}
</h1>
```

#### **Implement Working Filters:**
```tsx
// In SearchPage.tsx
const [locationFilter, setLocationFilter] = useState('near-me');
const [timeFilter, setTimeFilter] = useState('anytime');
const [sortBy, setSortBy] = useState('relevance');

// Replace "Organic" and "Boosted" with single "Sort" control
<Button onClick={() => setSortOpen(true)} className="flex h-7 items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 text-[11px] font-medium text-white shadow-none transition hover:bg-white/20">
  <SlidersHorizontal className="h-3 w-3" /> Sort
</Button>
```

#### **Filter Modal Implementation:**
```tsx
// New FilterModal.tsx
export function FilterModal({ isOpen, onClose, onApply }: FilterModalProps) {
  const [filters, setFilters] = useState({
    location: 'near-me',
    time: 'anytime',
    sort: 'relevance'
  });

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Filter Events</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Location Filter */}
          <div>
            <Label>Location</Label>
            <Select value={filters.location} onValueChange={(value) => setFilters({...filters, location: value})}>
              <SelectItem value="near-me">Near Me</SelectItem>
              <SelectItem value="city">My City</SelectItem>
              <SelectItem value="state">My State</SelectItem>
              <SelectItem value="country">My Country</SelectItem>
            </Select>
          </div>
          
          {/* Time Filter */}
          <div>
            <Label>When</Label>
            <Select value={filters.time} onValueChange={(value) => setFilters({...filters, time: value})}>
              <SelectItem value="anytime">Anytime</SelectItem>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="tomorrow">Tomorrow</SelectItem>
              <SelectItem value="this-week">This Week</SelectItem>
              <SelectItem value="this-month">This Month</SelectItem>
            </Select>
          </div>
          
          {/* Sort Options */}
          <div>
            <Label>Sort By</Label>
            <Select value={filters.sort} onValueChange={(value) => setFilters({...filters, sort: value})}>
              <SelectItem value="relevance">Most Relevant</SelectItem>
              <SelectItem value="date">Date</SelectItem>
              <SelectItem value="distance">Distance</SelectItem>
              <SelectItem value="popularity">Most Popular</SelectItem>
            </Select>
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onApply(filters)}>Apply Filters</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

---

## **Phase 3: Filter Tags Optimization**

### **Files to Modify:**
- `src/components/SearchPage.tsx` - Tag styling
- `src/index.css` - Compact tag styles

### **Implementation:**

#### **Compact Filter Tags (src/index.css):**
```css
/* Compact filter tags */
.filter-tag {
  font-size: 0.75rem;
  padding: 0.25rem 0.5rem;
  margin: 0.125rem;
  border-radius: 0.75rem;
  background: hsl(var(--muted));
  color: hsl(var(--muted-foreground));
  border: 1px solid hsl(var(--border));
  transition: all 200ms ease;
}

.filter-tag:hover {
  background: hsl(var(--muted) / 0.8);
  transform: translateY(-1px);
}

.filter-tag.active {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  border-color: hsl(var(--primary));
}

/* Horizontal scrolling for mobile */
.filter-container {
  display: flex;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
  gap: 0.5rem;
  padding: 0.5rem 0;
}

.filter-container::-webkit-scrollbar {
  display: none;
}
```

#### **SearchPage.tsx Updates:**
```tsx
// Compact filter implementation
<div className="filter-container">
  {filterTags.map((tag) => (
    <button
      key={tag.id}
      className={`filter-tag ${tag.active ? 'active' : ''}`}
      onClick={() => toggleFilter(tag.id)}
    >
      {tag.icon && <tag.icon className="h-3 w-3" />}
      {tag.label}
    </button>
  ))}
</div>
```

---

## **Phase 4: Event Page Contrast**

### **Files to Modify:**
- `src/pages/EventSlugPage.tsx` - Event subtitle styling
- `src/index.css` - Contrast improvements

### **Implementation:**

#### **WCAG-Compliant Contrast (src/index.css):**
```css
/* WCAG-compliant contrast for event subtitles */
.event-subtitle {
  color: hsl(var(--muted-foreground));
  opacity: 0.9;
  font-size: 0.875rem;
  line-height: 1.4;
  font-weight: 500;
}

/* Ensure 4.5:1 contrast ratio */
.event-subtitle {
  color: hsl(0 0% 60%); /* Dark mode - 4.5:1 contrast */
}

.dark .event-subtitle {
  color: hsl(0 0% 70%); /* Light mode - 4.5:1 contrast */
}

/* Event slug styling */
.event-slug {
  color: hsl(var(--muted-foreground));
  font-size: 0.875rem;
  font-weight: 400;
  line-height: 1.3;
  margin-top: 0.25rem;
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .event-subtitle,
  .event-slug {
    color: hsl(var(--foreground));
    font-weight: 600;
  }
}
```

#### **EventSlugPage.tsx Updates:**
```tsx
// Improved event subtitle
<div className="space-y-2">
  <h1 className="text-3xl font-bold text-foreground">{event.title}</h1>
  <p className="event-subtitle">{event.organizer}</p>
  <p className="event-slug">@{event.slug}</p>
</div>
```

---

## **Phase 5: Discover Page Alignment**

### **Files to Modify:**
- `src/components/SearchPage.tsx` - Header alignment
- `src/index.css` - Consistent spacing

### **Implementation:**

#### **Header Alignment (SearchPage.tsx):**
```tsx
// Align header and filter button
<div className="flex items-center justify-between mb-6">
  <div className="flex items-center gap-3">
    <Button variant="ghost" size="icon" onClick={onBack} className="h-10 w-10 rounded-full border border-transparent bg-white/80 text-slate-700 shadow-sm backdrop-blur">
      <ArrowLeft className="h-5 w-5" />
    </Button>
    <div>
      <h1 className="text-lg font-semibold text-slate-900">Discover</h1>
      <p className="text-xs text-slate-500">{displayedResults.length} events found</p>
    </div>
  </div>
  <div className="flex items-center gap-2">
    {filtersAppliedCount > 0 && (
      <span className="rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-700">
        {filtersAppliedCount} filters
      </span>
    )}
    <Button onClick={() => setFiltersOpen(true)} className="flex h-7 items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-3 text-[11px] font-medium text-white shadow-none transition hover:bg-white/20">
      <SlidersHorizontal className="h-3 w-3" /> Filter
    </Button>
  </div>
</div>
```

#### **Consistent Spacing (src/index.css):**
```css
/* Consistent header spacing */
.page-header {
  margin-top: 1rem;
  margin-bottom: 1.5rem;
}

@media (max-width: 640px) {
  .page-header {
    margin-top: 0.75rem;
    margin-bottom: 1rem;
  }
}
```

---

## **Phase 6: Navigation Consolidation**

### **Files to Modify:**
- `src/components/Navigation.tsx` - Merge Network & Messages
- `src/App.tsx` - Update routing
- `src/components/SocialPage.tsx` - New consolidated page

### **Implementation:**

#### **New SocialPage.tsx:**
```tsx
import { useState } from 'react';
import { Users, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function SocialPage() {
  const [activeTab, setActiveTab] = useState<'network' | 'messages'>('network');
  
  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b">
        <div className="flex items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold">Social</h1>
          <div className="flex gap-2">
            <Button
              variant={activeTab === 'network' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('network')}
              className="flex items-center gap-2"
            >
              <Users className="h-4 w-4" />
              Network
            </Button>
            <Button
              variant={activeTab === 'messages' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setActiveTab('messages')}
              className="flex items-center gap-2"
            >
              <MessageCircle className="h-4 w-4" />
              Messages
            </Button>
          </div>
        </div>
      </div>
      
      <div className="p-4">
        {activeTab === 'network' ? <NetworkTab /> : <MessagesTab />}
      </div>
    </div>
  );
}

function NetworkTab() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Your Network</h2>
      {/* Network content */}
    </div>
  );
}

function MessagesTab() {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Messages</h2>
      {/* Messages content */}
    </div>
  );
}
```

#### **Navigation.tsx Updates:**
```tsx
// Replace separate Network and Messages with single Social tab
const navItems = [
  { id: 'feed', label: 'Feed', icon: Home, path: '/' },
  { id: 'search', label: 'Search', icon: Search, path: '/search' },
  { id: 'posts', label: 'Posts', icon: Plus, path: '/create-post' },
  { id: 'tickets', label: 'Tickets', icon: Ticket, path: '/tickets' },
  { id: 'social', label: 'Social', icon: Users, path: '/social' }, // Combined
  { id: 'profile', label: 'Profile', icon: User, path: '/profile' },
];
```

#### **App.tsx Routing Updates:**
```tsx
// Add new route
<Route path="/social" element={<SocialPage />} />
```

---

## **Phase 7: Video Modal Simplification**

### **Files to Modify:**
- `src/components/PostCreatorModal.tsx` - Simplify options
- `src/components/VideoRecorder.tsx` - New component

### **Implementation:**

#### **New VideoRecorder.tsx:**
```tsx
import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Camera, Video, RotateCcw, X } from 'lucide-react';

interface VideoRecorderProps {
  eventId: string;
  onClose: () => void;
  onSave: (videoBlob: Blob) => void;
}

export function VideoRecorder({ eventId, onClose, onSave }: VideoRecorderProps) {
  const [camera, setCamera] = useState<'front' | 'rear'>('rear');
  const [isRecording, setIsRecording] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: camera },
        audio: true
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setRecordedChunks(prev => [...prev, event.data]);
        }
      };
      
      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
    }
  };
  
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };
  
  const saveVideo = () => {
    const blob = new Blob(recordedChunks, { type: 'video/webm' });
    onSave(blob);
    onClose();
  };
  
  return (
    <div className="fixed inset-0 z-50 bg-black">
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-black/80">
          <Button variant="ghost" onClick={onClose} className="text-white">
            <X className="h-5 w-5" />
          </Button>
          <h2 className="text-white font-semibold">Record Video</h2>
          <div className="w-10" /> {/* Spacer */}
        </div>
        
        {/* Camera preview */}
        <div className="flex-1 bg-black relative">
          <video 
            ref={videoRef}
            className="w-full h-full object-cover"
            autoPlay
            muted
            playsInline
          />
          
          {/* Recording indicator */}
          {isRecording && (
            <div className="absolute top-4 left-4 flex items-center gap-2 bg-red-500 text-white px-3 py-1 rounded-full">
              <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
              Recording
            </div>
          )}
        </div>
        
        {/* Controls */}
        <div className="p-4 bg-black/80">
          <div className="flex justify-center items-center gap-6">
            {/* Camera switch */}
            <Button 
              onClick={() => setCamera(camera === 'front' ? 'rear' : 'front')}
              className="w-12 h-12 rounded-full bg-white/20 text-white hover:bg-white/30"
            >
              <Camera className="h-5 w-5" />
            </Button>
            
            {/* Record button */}
            <Button
              onClick={isRecording ? stopRecording : startRecording}
              className={`w-16 h-16 rounded-full ${
                isRecording 
                  ? 'bg-red-500 hover:bg-red-600' 
                  : 'bg-white text-black hover:bg-gray-200'
              }`}
            >
              <Video className="h-8 w-8" />
            </Button>
            
            {/* Reset */}
            <Button 
              onClick={() => setRecordedChunks([])}
              className="w-12 h-12 rounded-full bg-white/20 text-white hover:bg-white/30"
            >
              <RotateCcw className="h-5 w-5" />
            </Button>
          </div>
          
          {/* Save button */}
          {recordedChunks.length > 0 && (
            <div className="mt-4 flex justify-center">
              <Button onClick={saveVideo} className="bg-primary text-primary-foreground">
                Save Video
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

#### **PostCreatorModal.tsx Updates:**
```tsx
// Simplified video creation
const [showVideoRecorder, setShowVideoRecorder] = useState(false);

// Replace complex video options with simple recorder
<Button 
  onClick={() => setShowVideoRecorder(true)}
  className="w-full"
>
  <Video className="h-4 w-4 mr-2" />
  Record Video
</Button>

{showVideoRecorder && (
  <VideoRecorder
    eventId={selectedEvent?.id || ''}
    onClose={() => setShowVideoRecorder(false)}
    onSave={(videoBlob) => {
      // Handle video save
      setShowVideoRecorder(false);
    }}
  />
)}
```

---

## **Phase 8: Accessibility & Performance**

### **Files to Modify:**
- `src/index.css` - Global accessibility styles
- `src/components/ui/button.tsx` - Focus states
- `src/components/ui/input.tsx` - Input accessibility
- `src/hooks/useAccessibility.ts` - New accessibility utilities

### **Implementation:**

#### **Global Accessibility Styles (src/index.css):**
```css
/* Accessibility improvements */
.focus-visible {
  outline: 2px solid hsl(var(--primary));
  outline-offset: 2px;
}

/* Touch targets minimum 44px */
.touch-target {
  min-height: 44px;
  min-width: 44px;
}

/* Dynamic type support */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}

/* High contrast mode support */
@media (prefers-contrast: high) {
  .border {
    border-width: 2px;
  }
  
  .text-muted-foreground {
    color: hsl(var(--foreground));
  }
}

/* Screen reader only content */
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

/* Skip links */
.skip-link {
  position: absolute;
  top: -40px;
  left: 6px;
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  padding: 8px;
  text-decoration: none;
  border-radius: 4px;
  z-index: 1000;
}

.skip-link:focus {
  top: 6px;
}
```

#### **New useAccessibility.ts Hook:**
```tsx
import { useEffect } from 'react';

export function useAccessibility() {
  useEffect(() => {
    // Add skip links
    const skipLink = document.createElement('a');
    skipLink.href = '#main-content';
    skipLink.textContent = 'Skip to main content';
    skipLink.className = 'skip-link';
    document.body.insertBefore(skipLink, document.body.firstChild);
    
    // Add main content ID
    const mainContent = document.querySelector('main');
    if (mainContent) {
      mainContent.id = 'main-content';
    }
    
    return () => {
      const existingSkipLink = document.querySelector('.skip-link');
      if (existingSkipLink) {
        existingSkipLink.remove();
      }
    };
  }, []);
  
  return {
    // Accessibility utilities
    announceToScreenReader: (message: string) => {
      const announcement = document.createElement('div');
      announcement.setAttribute('aria-live', 'polite');
      announcement.setAttribute('aria-atomic', 'true');
      announcement.className = 'sr-only';
      announcement.textContent = message;
      document.body.appendChild(announcement);
      
      setTimeout(() => {
        document.body.removeChild(announcement);
      }, 1000);
    }
  };
}
```

#### **Button.tsx Accessibility Updates:**
```tsx
// Enhanced button with proper focus states
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
        onFocus={(e) => {
          e.currentTarget.classList.add('focus-visible');
        }}
        onBlur={(e) => {
          e.currentTarget.classList.remove('focus-visible');
        }}
      />
    );
  }
);
```

---

## **📁 File Structure Summary**

### **Core Files to Modify:**
1. **`src/index.css`** - Global styles, scrolling, safe areas, accessibility
2. **`src/App.tsx`** - Routing updates, scroll containers
3. **`src/components/Navigation.tsx`** - Navigation consolidation
4. **`src/components/UnifiedFeedList.tsx`** - Feed improvements
5. **`src/components/SearchPage.tsx`** - Filter functionality, header alignment
6. **`src/components/feed/FeedActionRail.tsx`** - Button positioning
7. **`src/components/feed/FeedCaption.tsx`** - Caption spacing
8. **`src/pages/EventSlugPage.tsx`** - Event subtitle contrast
9. **`src/components/PostCreatorModal.tsx`** - Video modal simplification

### **New Files to Create:**
1. **`src/components/SocialPage.tsx`** - Consolidated social features
2. **`src/components/VideoRecorder.tsx`** - Simplified video recording
3. **`src/components/FilterModal.tsx`** - Advanced filtering
4. **`src/hooks/useAccessibility.ts`** - Accessibility utilities

### **Implementation Priority:**
1. **High Priority:** Global scrolling, safe areas, feed fixes, contrast improvements
2. **Medium Priority:** Navigation consolidation, filter improvements, header alignment
3. **Low Priority:** Video modal simplification, advanced accessibility features

---

## **🎯 Success Metrics**

### **Accessibility:**
- ✅ WCAG 2.2 AA compliance
- ✅ 4.5:1 contrast ratio for all text
- ✅ 44px minimum touch targets
- ✅ Screen reader compatibility
- ✅ Keyboard navigation support

### **Performance:**
- ✅ Smooth scrolling on all devices
- ✅ Proper safe area handling
- ✅ Optimized touch interactions
- ✅ Reduced layout shifts

### **UX Improvements:**
- ✅ Simplified navigation (Network + Messages → Social)
- ✅ Working filter functionality
- ✅ Consistent spacing and alignment
- ✅ Simplified video creation flow
- ✅ Better content hierarchy

This comprehensive plan addresses all identified UI/UX issues while maintaining code quality and performance! 🚀
