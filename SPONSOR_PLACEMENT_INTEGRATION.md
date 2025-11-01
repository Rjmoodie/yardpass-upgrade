# 🎨 Sponsor Placement Integration Guide

## Overview

Now that you have AI-powered sponsorship matching working, you need to **display sponsor branding** wherever events appear in your app.

---

## ✅ **New Components Created:**

### **1. `SponsorBadge` Component**
Location: `src/components/sponsorship/SponsorBadge.tsx`

**3 Display Variants:**

#### **Compact** - Small badge for cards
```tsx
<SponsorBadge eventId={event.id} variant="compact" />
// Shows: "🏢 Sponsored by TechCorp"
```

#### **Overlay** - For video/images
```tsx
<SponsorBadge eventId={event.id} variant="overlay" />
// Shows: Logo + "Sponsored" in top-right corner
```

#### **Full** - Detailed sponsor section
```tsx
<SponsorBadge eventId={event.id} variant="full" />
// Shows: All sponsors with logos, names, and tiers
```

### **2. `useEventSponsors` Hook**
Location: `src/hooks/useEventSponsors.ts`

```tsx
const { sponsors, loading, hasSponsor } = useEventSponsors(eventId);
```

---

## 📍 **Integration Points:**

### **1. Feed Posts** (Video/Image Feed)

Update `src/components/feed/` or wherever you render feed items:

```tsx
import { SponsorBadge } from '@/components/sponsorship/SponsorBadge';

function FeedPost({ post }) {
  return (
    <div className="relative">
      {/* Video/Image */}
      <video src={post.media_url} />
      
      {/* Sponsor Overlay */}
      <SponsorBadge 
        eventId={post.event_id} 
        variant="overlay" 
      />
      
      {/* Rest of post UI */}
    </div>
  );
}
```

---

### **2. Event Cards** (Browse/Search)

Update `src/components/EventCard.tsx` or `EventCardModern.tsx`:

```tsx
import { SponsorBadge } from '@/components/sponsorship/SponsorBadge';

function EventCard({ event }) {
  return (
    <Card>
      <CardHeader>
        <img src={event.cover_image_url} />
        
        {/* Add sponsor badge */}
        <SponsorBadge 
          eventId={event.id} 
          variant="compact"
          className="mt-2"
        />
        
        <CardTitle>{event.title}</CardTitle>
      </CardHeader>
    </Card>
  );
}
```

---

### **3. Event Details Page** (Event Slug)

Update `src/pages/EventDetails.tsx` or `EventSlugPage.tsx`:

```tsx
import { SponsorBadge } from '@/components/sponsorship/SponsorBadge';
import { useEventSponsors } from '@/hooks/useEventSponsors';

function EventDetailsPage({ eventId }) {
  const { sponsors, hasSponsor } = useEventSponsors(eventId);
  
  return (
    <div>
      {/* Hero Section */}
      <div className="relative">
        <img src={event.cover_image_url} className="w-full h-96" />
        
        {hasSponsor && (
          <div className="absolute top-4 right-4">
            <SponsorBadge eventId={eventId} variant="overlay" />
          </div>
        )}
      </div>

      {/* Event Info */}
      <div className="p-6">
        <h1>{event.title}</h1>
        <p>{event.description}</p>

        {/* Sponsor Section */}
        {hasSponsor && (
          <div className="mt-8 p-6 bg-neutral-50 rounded-lg">
            <SponsorBadge eventId={eventId} variant="full" />
          </div>
        )}
        
        {/* Show sponsor benefits */}
        {sponsors.map(sponsor => (
          <div key={sponsor.id} className="mt-4">
            {sponsor.tier === "Gold" && sponsor.benefits?.booth_space && (
              <p className="text-sm text-neutral-600">
                ✨ Meet {sponsor.name} at their premium booth
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

### **4. Search/Browse Pages**

Update `src/pages/SearchPage.tsx`:

```tsx
import { SponsorBadge } from '@/components/sponsorship/SponsorBadge';

function SearchResults({ events }) {
  return events.map(event => (
    <div key={event.id} className="border rounded-lg p-4">
      <h3>{event.title}</h3>
      
      {/* Add sponsor indicator */}
      <SponsorBadge eventId={event.id} variant="compact" />
      
      <Button>View Event</Button>
    </div>
  ));
}
```

---

### **5. Related/Similar Events**

Update `src/components/BecauseYouViewed.tsx`:

```tsx
import { SponsorBadge } from '@/components/sponsorship/SponsorBadge';

// In the similar event cards:
<div className="event-card">
  <img src={event.cover_image_url} />
  <h4>{event.title}</h4>
  
  {/* Add sponsor badge */}
  <SponsorBadge eventId={event.event_id} variant="compact" />
</div>
```

---

## 🎨 **Visual Hierarchy:**

### **Gold Tier Sponsors:**
- ✨ **Prominent placement** - Logo + name + special badge
- 📍 Top of sponsor section
- 🎯 Featured in event hero
- ⭐ Gold star icon

### **Silver Tier:**
- 🥈 **Standard placement** - Logo + name
- 📍 Middle of sponsor section
- 🎯 Shown in details page

### **Bronze Tier:**
- 🥉 **Minimal placement** - Name only or small logo
- 📍 Bottom of sponsor section
- 🎯 Listed in sponsor section

---

## 📊 **Query to Get Event Sponsors:**

The hook uses this query:

```sql
SELECT 
  so.id,
  so.sponsor_id,
  s.name,
  s.logo_url,
  sp.tier,
  so.status
FROM sponsorship_orders so
JOIN sponsors s ON s.id = so.sponsor_id
JOIN sponsorship_packages sp ON sp.id = so.package_id
WHERE so.event_id = '<event-id>'
AND so.status IN ('accepted', 'live', 'completed');
```

---

## 🚀 **Quick Implementation:**

### **Step 1: Add to Feed Posts**

Find where you render video posts and add:

```tsx
import { SponsorBadge } from '@/components/sponsorship/SponsorBadge';

<div className="relative">
  <video />
  <SponsorBadge eventId={post.event_id} variant="overlay" />
</div>
```

### **Step 2: Add to Event Cards**

Find `EventCard` component and add:

```tsx
<Card>
  <img />
  <SponsorBadge eventId={event.id} variant="compact" />
  <h3>{event.title}</h3>
</Card>
```

### **Step 3: Add to Event Details**

Find event details page and add:

```tsx
{/* After event description */}
<SponsorBadge eventId={eventId} variant="full" />
```

---

## 🎯 **Placement Rules:**

### **Priority Order:**
1. **Feed overlay** - Subtle, non-intrusive
2. **Event card badge** - Visible but not overwhelming
3. **Details page section** - Full sponsor showcase
4. **Search results** - Compact badge

### **Design Guidelines:**
- ✅ Don't obscure main content
- ✅ Respect brand guidelines (sponsor logos)
- ✅ Make it valuable (not annoying)
- ✅ Show tier hierarchy (Gold most prominent)
- ✅ Mobile-responsive placement

---

## 💡 **Advanced: Sponsored Content Boost**

You could boost sponsored events in the feed ranking:

```tsx
// In your feed ranking logic
const eventScore = baseScore + (hasSponsor ? 0.2 : 0);
```

Or modify `get_home_feed_ids` RPC to prioritize sponsored events.

---

## 📋 **To-Do Checklist:**

- [ ] Add `<SponsorBadge variant="overlay" />` to feed posts
- [ ] Add `<SponsorBadge variant="compact" />` to event cards
- [ ] Add `<SponsorBadge variant="full" />` to event details
- [ ] Test with your 3 sample sponsors
- [ ] Adjust styling to match your design system
- [ ] Add sponsor click tracking (optional)

---

**Want me to integrate these components into your existing feed and event pages?** I can show you exactly where to add them! 🎨

