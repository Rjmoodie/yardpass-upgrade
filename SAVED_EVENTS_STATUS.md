# Saved Events Status Report 📋

## Summary
The saved events functionality is **partially wired up**. The backend and display are ready, but the save/unsave action buttons are currently disabled.

---

## ✅ What's Working

### 1. **Database Table** ✅
```sql
Table: public.saved_events
Columns:
  - id (uuid)
  - user_id (uuid) → references user_profiles
  - event_id (uuid) → references events.events
  - saved_at (timestamp)
```

**Status**: ✅ Table exists and is ready to use

---

### 2. **Profile Page Display** ✅

**Location**: `src/pages/new-design/ProfilePage.tsx`

**Features**:
- ✅ "Saved" tab exists next to "Posts" tab
- ✅ Loads saved events from database
- ✅ Displays saved events in grid
- ✅ Shows empty state when no saved events

**Code**:
```tsx
// Fetch saved events (lines 168-206)
const loadSavedEvents = async () => {
  const { data, error } = await supabase
    .from('saved_events')
    .select(`
      id,
      event_id,
      events (
        id,
        title,
        cover_image_url,
        start_at
      )
    `)
    .eq('user_id', targetUserId)
    .order('saved_at', { ascending: false });
    
  setSavedEvents(events);
};
```

**Status**: ✅ Fully functional - loads and displays saved events

---

## ❌ What's NOT Working

### **Save/Unsave Button** ❌

**Location**: `src/pages/new-design/EventDetailsPage.tsx` (lines 263-303)

**Current State**: Code is commented out with TODO

**The Button**:
```tsx
// Visible but not functional!
<button onClick={handleToggleSave}>
  <Heart className={`h-5 w-5 ${isSaved ? 'fill-red-500' : 'text-foreground'}`} />
</button>
```

**The Commented Code**:
```tsx
const handleToggleSave = async () => {
  // TODO: Implement saved_events table
  return;  // ← Currently exits immediately!
  
  // Commented out code below:
  // if (isSaved) {
  //   await supabase
  //     .from('saved_events')
  //     .delete()
  //     .eq('user_id', user.id)
  //     .eq('event_id', event.id);
  // } else {
  //   await supabase
  //     .from('saved_events')
  //     .insert({
  //       user_id: user.id,
  //       event_id: event.id
  //     });
  // }
}
```

**Status**: ❌ Not functional - needs to be uncommented and tested

---

## 🔧 How It Should Work

### **User Flow**:

1. **User browses events**
   - Goes to Event Details page
   - Sees heart icon in top-right corner

2. **User clicks heart icon**
   - First click: Saves event
     - Heart fills with red color
     - Toast: "Event saved!"
     - Row inserted into `saved_events` table
   
3. **User views saved events**
   - Goes to their profile
   - Clicks "Saved" tab
   - Sees grid of saved events
   - Clicks event → navigates to Event Details

4. **User unsaves event**
   - Goes back to Event Details
   - Clicks filled heart icon
   - Heart becomes outline
   - Toast: "Removed from saved events"
   - Row deleted from `saved_events` table

---

## 🎯 What Needs to Be Done

### **To Activate Saved Events**:

1. **Uncomment the save/unsave code** in `EventDetailsPage.tsx`
2. **Remove the early return** in `handleToggleSave`
3. **Test the functionality**:
   - Save an event
   - Check it appears in "Saved" tab
   - Unsave the event
   - Verify it disappears from "Saved" tab

---

## 📝 Current Code Location

### **EventDetailsPage.tsx** (Lines to modify)

**Line 182-192**: Check if event is saved
```tsx
// Currently commented:
// if (user) {
//   const { data: savedData } = await supabase
//     .from('saved_events')
//     .select('id')
//     .eq('user_id', user.id)
//     .eq('event_id', data.id)
//     .maybeSingle();
//   
//   setIsSaved(!!savedData);
// }
```

**Line 263-303**: Save/unsave handler
```tsx
// Currently disabled:
const handleToggleSave = async () => {
  // TODO: Implement saved_events table
  return;  // ← Remove this line!
  
  // Uncomment code below...
}
```

---

## 🎨 Visual States

### **Heart Icon States**:

**Not Saved**:
```tsx
<Heart className="h-5 w-5 text-foreground" />
// Outline heart, theme color
```

**Saved**:
```tsx
<Heart className="h-5 w-5 fill-red-500 text-red-500" />
// Filled red heart
```

---

## 📊 Database Schema

### **saved_events Table**

```sql
CREATE TABLE public.saved_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(user_id),
  event_id UUID NOT NULL REFERENCES events.events(id),
  saved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Unique constraint: user can't save same event twice
  UNIQUE(user_id, event_id)
);

-- Index for fast lookups
CREATE INDEX idx_saved_events_user ON saved_events(user_id);
CREATE INDEX idx_saved_events_event ON saved_events(event_id);
```

---

## ✨ Additional Features to Consider

### **1. Save Button on Search Results**
Currently only Event Details has the heart button. Could add to:
- Search page event cards
- Feed event cards

### **2. Saved Count**
Show how many users saved each event:
```tsx
<span>{savedCount} saves</span>
```

### **3. Saved Collections**
Allow users to organize saved events into collections:
- "Want to Go"
- "Favorites"
- "Maybe"

### **4. Saved Posts** (vs Saved Events)
Currently only events can be saved. Could extend to:
- User posts (from event feed)
- Social content

---

## 🎯 Quick Activation Guide

To activate saved events functionality right now:

### **Step 1**: Uncomment initialization code
**File**: `src/pages/new-design/EventDetailsPage.tsx`  
**Line**: 182-192

```tsx
// BEFORE:
// if (user) {
//   const { data: savedData } = await supabase...

// AFTER:
if (user) {
  const { data: savedData } = await supabase
    .from('saved_events')
    .select('id')
    .eq('user_id', user.id)
    .eq('event_id', data.id)
    .maybeSingle();
  
  setIsSaved(!!savedData);
}
```

### **Step 2**: Uncomment save/unsave handler
**File**: `src/pages/new-design/EventDetailsPage.tsx`  
**Line**: 273-299

```tsx
// BEFORE:
const handleToggleSave = async () => {
  // TODO: Implement saved_events table
  return;  // ← Remove this!
  
  // Comment out code below:
  // if (isSaved) {
  //   await supabase...

// AFTER:
const handleToggleSave = async () => {
  if (!user || !event) {
    toast({
      title: 'Sign in required',
      description: 'Please sign in to save events',
    });
    return;
  }

  try {
    if (isSaved) {
      // Remove from saved
      await supabase
        .from('saved_events')
        .delete()
        .eq('user_id', user.id)
        .eq('event_id', event.id);
      
      setIsSaved(false);
      toast({ title: 'Removed from saved events' });
    } else {
      // Add to saved
      await supabase
        .from('saved_events')
        .insert({
          user_id: user.id,
          event_id: event.id
        });
      
      setIsSaved(true);
      toast({ title: 'Event saved!' });
    }
  } catch (error) {
    console.error('Error toggling save:', error);
    toast({
      title: 'Error',
      description: 'Failed to save event',
      variant: 'destructive'
    });
  }
};
```

### **Step 3**: Test
1. Go to any event details page
2. Click the heart icon
3. Check your profile → "Saved" tab
4. Event should appear there!

---

## ✅ Summary

| Component | Status |
|-----------|--------|
| Database table | ✅ Ready |
| Profile "Saved" tab | ✅ Working |
| Display saved events | ✅ Working |
| Empty state | ✅ Working |
| Save button UI | ✅ Visible |
| Save functionality | ❌ Commented out |
| Unsave functionality | ❌ Commented out |
| Check if saved | ❌ Commented out |

**Overall Status**: 📊 70% complete - just needs activation!

---

## 🎯 Next Steps

1. **Uncomment the code** (5 minutes)
2. **Test the flow** (10 minutes)
3. **Deploy** (ready to go!)

**Total time to activate**: ~15-20 minutes 🚀

---

**The infrastructure is ready - just needs the switch flipped!** 💡


