# 🔌 New Design Integration Plan - Complete Backend Connection

**Status:** Ready for implementation  
**Updated:** October 24, 2025

---

## 📋 EXECUTIVE SUMMARY

**Screens with Mock Data (6 total):**
1. ✅ ProfilePage.tsx
2. ✅ TicketsPage.tsx
3. ✅ SearchPage.tsx
4. ✅ NotificationsPage.tsx
5. ✅ MessagesPage.tsx
6. ✅ EventDetailsPage.tsx

**Existing Hooks & Services Available:**
- `useOptimizedQueries()` - User profiles with tickets & events
- `useUserConnections()` - Following/followers
- `useMessaging()` - Direct messages
- `useGuestManagement()` - Tickets & guest lists
- `useTicketAnalytics()` - Ticket data
- `useOrganizerData()` - Event data
- `useAffinityFeed()` - Feed events
- `useUnifiedFeedInfinite()` - Feed content

---

## 1️⃣ PROFILE PAGE - Integration Plan

### **Current Mock Data:**
```typescript
const mockProfile: UserProfile = {
  name: "Alex Johnson",
  username: "@alexj",
  avatar: "https://images.unsplash.com/...",
  coverImage: "https://images.unsplash.com/...",
  bio: "Event enthusiast | Music lover | NYC 🗽",
  location: "New York, NY",
  website: "alexjohnson.com",
  stats: { posts: 42, followers: 1234, following: 567 },
  socialLinks: { instagram: "alexj", twitter: "alexj" }
};

const mockPosts: Post[] = [...]; // 6 mock posts
```

### **Integration Solution:**

**Step 1: Import existing hooks**
```typescript
import { useAuth } from '@/contexts/AuthContext';
import { useOptimizedQueries } from '@/hooks/useOptimizedQueries';
import { useUserConnections } from '@/hooks/useUserConnections';
```

**Step 2: Fetch real data**
```typescript
const { user } = useAuth();
const { fetchUserProfileOptimized } = useOptimizedQueries();
const { following, followers } = useUserConnections(user?.id);
const [profile, setProfile] = useState(null);
const [posts, setPosts] = useState([]);

useEffect(() => {
  const loadProfile = async () => {
    if (!user?.id) return;
    const data = await fetchUserProfileOptimized(user.id);
    setProfile(data);
  };
  loadProfile();
}, [user?.id]);
```

**Step 3: Map data to UI**
```typescript
// Profile mapping
avatar: profile?.photo_url || DEFAULT_AVATAR
name: profile?.display_name || 'User'
bio: profile?.bio || ''
location: profile?.location || ''
stats: {
  posts: posts.length,
  followers: followers.length,
  following: following.length
}
```

**Step 4: Fetch user posts**
```typescript
useEffect(() => {
  const loadPosts = async () => {
    const { data } = await supabase
      .from('event_posts')
      .select('*')
      .eq('author_user_id', user.id)
      .order('created_at', { ascending: false });
    setPosts(data || []);
  };
  loadPosts();
}, [user?.id]);
```

---

## 2️⃣ TICKETS PAGE - Integration Plan

### **Current Mock Data:**
```typescript
const mockTickets: Ticket[] = [
  {
    id: "1",
    eventName: "Summer Music Festival 2024",
    date: "Aug 15, 2024",
    time: "7:00 PM",
    location: "Central Park, NY",
    image: "https://images.unsplash.com/...",
    qrCode: "TICKET-12345",
    status: "active"
  },
  // ... more mock tickets
];
```

###  **Integration Solution:**

**Step 1: Import hooks**
```typescript
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useTicketQrToken } from '@/hooks/useTicketQrToken';
```

**Step 2: Fetch user tickets**
```typescript
const { user } = useAuth();
const [tickets, setTickets] = useState([]);

useEffect(() => {
  const loadTickets = async () => {
    const { data, error } = await supabase
      .from('tickets')
      .select(`
        id,
        status,
        qr_code,
        created_at,
        events!fk_tickets_event_id (
          id,
          title,
          start_at,
          venue,
          address,
          cover_image_url
        ),
        ticket_tiers!fk_tickets_tier_id (
          name,
          price_cents
        )
      `)
      .eq('owner_user_id', user.id)
      .order('created_at', { ascending: false });
      
    if (!error) setTickets(data || []);
  };
  
  loadTickets();
}, [user?.id]);
```

**Step 3: Map to UI format**
```typescript
const mappedTickets = tickets.map(ticket => ({
  id: ticket.id,
  eventName: ticket.events.title,
  date: new Date(ticket.events.start_at).toLocaleDateString(),
  time: new Date(ticket.events.start_at).toLocaleTimeString(),
  location: `${ticket.events.venue}, ${ticket.events.address}`,
  image: ticket.events.cover_image_url,
  qrCode: ticket.qr_code,
  status: ticket.status,
  tierName: ticket.ticket_tiers.name
}));
```

---

## 3️⃣ SEARCH PAGE - Integration Plan

### **Current Mock Data:**
```typescript
const mockEvents: Event[] = [
  {
    id: "1",
    title: "Summer Music Festival",
    date: "Aug 15, 2024",
    location: "Central Park, NY",
    image: "https://images.unsplash.com/...",
    category: "Music",
    price: "$45"
  },
  // ... more mock events
];
```

### **Integration Solution:**

**Step 1: Use existing search**
```typescript
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
```

**Step 2: Implement search query**
```typescript
const [searchQuery, setSearchQuery] = useState('');
const [events, setEvents] = useState([]);
const [loading, setLoading] = useState(false);

const handleSearch = async (query: string) => {
  setLoading(true);
  
  const { data, error } = await supabase
    .from('events')
    .select(`
      id,
      title,
      start_at,
      venue,
      address,
      cover_image_url,
      category,
      ticket_tiers!fk_ticket_tiers_event_id (
        price_cents
      )
    `)
    .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
    .eq('visibility', 'public')
    .order('start_at', { ascending: true })
    .limit(20);
    
  if (!error) setEvents(data || []);
  setLoading(false);
};
```

**Step 3: Category filtering**
```typescript
const filterByCategory = async (category: string) => {
  const { data } = await supabase
    .from('events')
    .select('*')
    .eq('category', category)
    .eq('visibility', 'public')
    .order('start_at', { ascending: true });
    
  setEvents(data || []);
};
```

---

## 4️⃣ NOTIFICATIONS PAGE - Integration Plan

### **Current Mock Data:**
```typescript
const mockNotifications: Notification[] = [
  {
    id: "1",
    type: "like",
    user: { name: "Sarah Johnson", avatar: "..." },
    message: "liked your post",
    time: "2 hours ago",
    isRead: false
  },
  // ... more mock notifications
];
```

### **Integration Solution:**

**Step 1: Create notifications query**
```typescript
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const { user } = useAuth();
const [notifications, setNotifications] = useState([]);

useEffect(() => {
  const loadNotifications = async () => {
    // Fetch from notifications table (if exists) or create aggregated view
    const { data: reactions } = await supabase
      .from('event_reactions')
      .select(`
        id,
        kind,
        created_at,
        user_id,
        user_profiles!event_reactions_user_id_fkey (
          display_name,
          photo_url
        ),
        event_posts!event_reactions_post_id_fkey (
          author_user_id
        )
      `)
      .eq('event_posts.author_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
      
    // Fetch follows
    const { data: follows } = await supabase
      .from('follows')
      .select(`
        id,
        created_at,
        follower_user_id,
        user_profiles!follows_follower_user_id_fkey (
          display_name,
          photo_url
        )
      `)
      .eq('target_id', user.id)
      .eq('target_type', 'user')
      .order('created_at', { ascending: false})
      .limit(50);
      
    // Combine and sort
    const combined = [
      ...(reactions || []).map(r => ({
        type: r.kind,
        user: r.user_profiles,
        time: r.created_at,
        isRead: false
      })),
      ...(follows || []).map(f => ({
        type: 'follow',
        user: f.user_profiles,
        time: f.created_at,
        isRead: false
      }))
    ].sort((a, b) => new Date(b.time) - new Date(a.time));
    
    setNotifications(combined);
  };
  
  loadNotifications();
}, [user?.id]);
```

---

## 5️⃣ MESSAGES PAGE - Integration Plan

### **Current Mock Data:**
```typescript
const mockConversations: Conversation[] = [
  {
    id: "1",
    user: { name: "Sarah Johnson", avatar: "...", status: "online" },
    lastMessage: "See you at the event!",
    time: "2m ago",
    unread: 2
  },
  // ... more mock conversations
];
```

### **Integration Solution:**

**Step 1: Use existing messaging hook**
```typescript
import { useMessaging } from '@/hooks/useMessaging';

const {
  conversations,
  loadConversations,
  sendMessage,
  markAsRead
} = useMessaging();

useEffect(() => {
  loadConversations();
}, []);
```

**Step 2: Fetch conversations**
```typescript
// Already implemented in useMessaging hook
// Returns format:
// {
//   id: conversationId,
//   participants: [user1, user2],
//   lastMessage: { text, timestamp, sender },
//   unreadCount: number
// }
```

**Step 3: Real-time subscriptions**
```typescript
useEffect(() => {
  const channel = supabase
    .channel('messages')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'messaging',
        table: 'direct_messages'
      },
      (payload) => {
        // Update conversations list
        loadConversations();
      }
    )
    .subscribe();
    
  return () => {
    supabase.removeChannel(channel);
  };
}, []);
```

---

## 6️⃣ EVENT DETAILS PAGE - Integration Plan

### **Current Mock Data:**
```typescript
const mockEvent = {
  id: "1",
  title: "Summer Music Festival 2024",
  date: "Saturday, August 15, 2024",
  time: "7:00 PM - 11:00 PM",
  location: "Central Park",
  address: "New York, NY 10024",
  description: "Join us for an unforgettable evening...",
  image: "https://images.unsplash.com/...",
  organizer: { name: "Events Co", avatar: "...", verified: true },
  stats: { interested: 1234, attending: 567 },
  tickets: [...]
};
```

### **Integration Solution:**

**Step 1: Use route params**
```typescript
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const { eventId } = useParams();
const [event, setEvent] = useState(null);
```

**Step 2: Fetch event details**
```typescript
useEffect(() => {
  const loadEvent = async () => {
    const { data, error } = await supabase
      .from('events')
      .select(`
        *,
        ticket_tiers!fk_ticket_tiers_event_id (
          id,
          name,
          price_cents,
          quantity,
          sold_count,
          badge_label
        ),
        user_profiles!events_created_by_fkey (
          display_name,
          photo_url
        )
      `)
      .eq('id', eventId)
      .single();
      
    if (!error) setEvent(data);
  };
  
  loadEvent();
}, [eventId]);
```

**Step 3: Fetch attendee count**
```typescript
const { data: attendeeCount } = await supabase
  .from('tickets')
  .select('id', { count: 'exact', head: true })
  .eq('event_id', eventId)
  .eq('status', 'active');
```

---

## 🗺️ ROUTES INTEGRATION

### **Update App.tsx with new routes:**

```typescript
// Import New Design components
import ProfilePage from '@/New design/ProfilePage';
import TicketsPage from '@/New design/TicketsPage';
import SearchPage from '@/New design/SearchPage';
import NotificationsPage from '@/New design/NotificationsPage';
import MessagesPage from '@/New design/MessagesPage';
import EventDetailsPage from '@/New design/EventDetailsPage';

// Add routes
<Route 
  path="/profile-new" 
  element={
    <AuthGuard>
      <ProfilePage />
    </AuthGuard>
  } 
/>

<Route 
  path="/tickets-new" 
  element={
    <AuthGuard>
      <TicketsPage />
    </AuthGuard>
  } 
/>

<Route path="/search-new" element={<SearchPage />} />

<Route 
  path="/notifications-new" 
  element={
    <AuthGuard>
      <NotificationsPage />
    </AuthGuard>
  } 
/>

<Route 
  path="/messages-new" 
  element={
    <AuthGuard>
      <MessagesPage />
    </AuthGuard>
  } 
/>

<Route path="/event-new/:eventId" element={<EventDetailsPage />} />
```

---

## 🔧 NAVIGATION INTEGRATION

### **Update Navigation.tsx to use new design:**

```typescript
// Current structure
const navItems = [
  { id: 'feed', path: '/', icon: Home },
  { id: 'search', path: '/search-new', icon: Search },
  { id: 'tickets', path: '/tickets-new', icon: Ticket },
  { id: 'profile', path: '/profile-new', icon: User },
];
```

---

## 📦 SHARED UTILITIES TO CREATE

### **1. Data Transformers**

**File:** `src/lib/dataTransformers.ts`
```typescript
export function transformUserProfile(dbProfile: any) {
  return {
    name: dbProfile.display_name,
    username: `@${dbProfile.username || dbProfile.user_id.slice(0, 8)}`,
    avatar: dbProfile.photo_url || DEFAULT_AVATAR,
    bio: dbProfile.bio || '',
    location: dbProfile.location || '',
    website: dbProfile.website || '',
    stats: {
      posts: dbProfile.posts?.length || 0,
      followers: dbProfile.followers_count || 0,
      following: dbProfile.following_count || 0
    }
  };
}

export function transformTicket(dbTicket: any) {
  return {
    id: dbTicket.id,
    eventName: dbTicket.events?.title || 'Event',
    date: new Date(dbTicket.events?.start_at).toLocaleDateString(),
    time: new Date(dbTicket.events?.start_at).toLocaleTimeString(),
    location: `${dbTicket.events?.venue}, ${dbTicket.events?.address}`,
    image: dbTicket.events?.cover_image_url,
    qrCode: dbTicket.qr_code,
    status: dbTicket.status
  };
}

export function transformEvent(dbEvent: any) {
  return {
    id: dbEvent.id,
    title: dbEvent.title,
    date: new Date(dbEvent.start_at).toLocaleDateString(),
    time: new Date(dbEvent.start_at).toLocaleTimeString(),
    location: dbEvent.venue,
    address: dbEvent.address,
    image: dbEvent.cover_image_url,
    category: dbEvent.category,
    description: dbEvent.description,
    price: dbEvent.ticket_tiers?.[0]?.price_cents 
      ? `$${(dbEvent.ticket_tiers[0].price_cents / 100).toFixed(2)}`
      : 'Free'
  };
}
```

---

## ✅ IMPLEMENTATION CHECKLIST

### **Phase 1: Core Data Connections (Priority)**
- [ ] Create data transformer utilities
- [ ] Integrate ProfilePage with real user data
- [ ] Integrate TicketsPage with real ticket data
- [ ] Integrate SearchPage with real event search
- [ ] Test all data flows

### **Phase 2: Social Features**
- [ ] Integrate NotificationsPage with real notifications
- [ ] Integrate MessagesPage with real messaging
- [ ] Add real-time subscriptions
- [ ] Test notification delivery

### **Phase 3: Event Features**
- [ ] Integrate EventDetailsPage with real event data
- [ ] Connect ticket purchase flow
- [ ] Add attendee list
- [ ] Test event interactions

### **Phase 4: Navigation & Routes**
- [ ] Update App.tsx routes
- [ ] Update Navigation component
- [ ] Add route guards
- [ ] Test navigation flow

### **Phase 5: Polish & Testing**
- [ ] Remove all mock data
- [ ] Add loading states
- [ ] Add error handling
- [ ] End-to-end testing
- [ ] Performance optimization

---

## 🚨 CRITICAL NOTES

1. **No Mock Data Remaining**: All 6 screens must fetch from Supabase
2. **Existing Hooks**: Use existing hooks where available (don't recreate)
3. **Data Transformers**: Create shared transformers for consistency
4. **Error Handling**: Add proper error states for failed fetches
5. **Loading States**: Show spinners while data loads
6. **Real-time**: Use Supabase subscriptions for live updates
7. **Route Guards**: Protect auth-required routes with `AuthGuard`
8. **Type Safety**: Use existing TypeScript types from `database.types.ts`

---

**Ready to implement?** This plan provides complete backend integration for all New Design screens with no remaining mock data.

**Estimated Implementation Time:** 6-8 hours for complete integration

**Files to Create:** 1 (dataTransformers.ts)  
**Files to Modify:** 8 (6 screen files + App.tsx + Navigation.tsx)

