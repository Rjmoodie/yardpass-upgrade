# 🔘 New Design - Complete Button Audit & Wiring

**Status:** In Progress  
**Date:** October 24, 2025

---

## 📋 BUTTON INVENTORY

### **1. PROFILE PAGE**

| Button | Current Action | Should Connect To | Status |
|--------|---------------|-------------------|--------|
| Share | `handleShare()` | Native share or copy link | ✅ Working |
| Settings | Navigate to `/edit-profile` | Edit profile page | ✅ Working |
| Edit Profile | Navigate to `/edit-profile` | Edit profile page | ✅ Working |
| Followers Count | Navigate to `/u/:id/followers` | Followers list | ✅ Working |
| Following Count | Navigate to `/u/:id/following` | Following list | ✅ Working |
| Post Grid Item | Navigate to post/event | Post or event detail | ✅ Working |
| **MISSING:** Follow/Unfollow | N/A | `useFollow` hook | ❌ Need to add |

### **2. TICKETS PAGE**

| Button | Current Action | Should Connect To | Status |
|--------|---------------|-------------------|--------|
| Upcoming Tab | Filter tickets | Local state filter | ✅ Working |
| Past Tab | Filter tickets | Local state filter | ✅ Working |
| Expand QR | Toggle QR display | Local state | ✅ Working |
| Download | `handleDownload()` | Download QR image | ✅ Working |
| Share | `handleShare()` | Native share | ✅ Working |
| View Event | Navigate to event | Event detail page | ✅ Working |
| Browse Events (empty) | Navigate to search | Search page | ✅ Working |

### **3. SEARCH PAGE**

| Button | Current Action | Should Connect To | Status |
|--------|---------------|-------------------|--------|
| Search Input | Update state | Debounced search | ✅ Working |
| Clear Search (X) | Clear query | Reset search | ✅ Working |
| Filter Toggle | Show/hide filters | Local state | ✅ Working |
| Category Pills | Filter by category | Update filters | ✅ Working |
| Price Range | Filter by price | Update filters | ✅ Working |
| Date Filter | Filter by date | Update filters | ✅ Working |
| Event Card | Navigate to event | Event detail | ✅ Working |
| Clear Filters (empty) | Reset all filters | Reset state | ✅ Working |

### **4. EVENT DETAILS PAGE**

| Button | Current Action | Should Connect To | Status |
|--------|---------------|-------------------|--------|
| Back | Navigate back | `navigate(-1)` | ✅ Working |
| Save/Heart | Toggle save | `saved_events` table | ✅ Working |
| Share | Native share | Share API | ✅ Working |
| Organizer | Navigate to profile | User profile | ✅ Working |
| Tab Buttons | Switch tabs | Local state | ✅ Working |
| Ticket Tier | Select tier | Local state | ✅ Working |
| Get Tickets | Purchase flow | Checkout | ✅ Working |
| Sticky Get Tickets | Navigate to tickets tab | Local state | ✅ Working |
| **MISSING:** Add to Calendar | N/A | Calendar integration | ❌ Need to add |
| **MISSING:** Report Event | N/A | Report modal | ❌ Need to add |

### **5. MESSAGES PAGE**

| Button | Current Action | Should Connect To | Status |
|--------|---------------|-------------------|--------|
| Search Input | Filter conversations | Local filter | ⚠️ Partial |
| Clear Search (X) | Clear search | Reset state | ⚠️ Partial |
| Conversation Item | Select conversation | Load messages | ⚠️ Partial |
| Back (mobile) | Deselect conversation | Local state | ⚠️ Partial |
| More Options | Show menu | Options menu | ❌ Not wired |
| Image Attach | Upload image | File picker | ❌ Not wired |
| Emoji | Show emoji picker | Emoji picker | ❌ Not wired |
| Send Message | Send message | `useMessaging.sendMessage()` | ⚠️ Partial |

### **6. NOTIFICATIONS PAGE**

| Button | Current Action | Should Connect To | Status |
|--------|---------------|-------------------|--------|
| Settings | Navigate to settings | Notification settings | ⚠️ Route not created |
| All Tab | Show all | Filter state | ✅ Working |
| Unread Tab | Show unread | Filter state | ✅ Working |
| Mark All Read | Mark all as read | Database update | ⚠️ Not persisted |
| Notification Item | Navigate to content | Post/profile/event | ✅ Working |

### **7. FEED PAGE (NEW DESIGN)**

| Button | Current Action | Should Connect To | Status |
|--------|---------------|-------------------|--------|
| Top Filters (Location) | Open filter modal | `FeedFilter` | ✅ Working |
| Top Filters (Date) | Open filter modal | `FeedFilter` | ✅ Working |
| Top Filters (Filters) | Open filter modal | `FeedFilter` | ✅ Working |
| Floating Create Post | Open post creator | `PostCreatorModal` | ✅ Working |
| Floating Messages | Navigate to messages | Messages page | ✅ Working |
| Floating Sound Toggle | Toggle sound | Global sound state | ✅ Working |
| Event Card - Tickets | Open ticket modal | `EventTicketModal` | ✅ Working |
| Event Card - Like | Toggle like | Optimistic like | ✅ Working |
| Event Card - Comment | Open comment modal | `CommentModal` | ✅ Working |
| Event Card - View Event | Navigate to event | Event detail | ✅ Working |
| Post Card - Like | Toggle like | Optimistic like | ✅ Working |
| Post Card - Comment | Open comment modal | `CommentModal` | ✅ Working |
| Post Card - Share | Share post | Share API | ✅ Working |
| Post Card - Author | Navigate to profile | User profile | ✅ Working |
| Post Card - More | Show menu | Options menu | ❌ Not wired |

### **8. NAVIGATION**

| Button | Current Action | Should Connect To | Status |
|--------|---------------|-------------------|--------|
| Feed | Navigate to feed | `/` | ✅ Working |
| Search | Navigate to search | `/search-new` | ✅ Working |
| Tickets | Navigate to tickets | `/tickets-new` | ✅ Working |
| Messages | Navigate to messages | `/messages-new` | ✅ Working |
| Profile | Navigate to profile | `/profile-new` | ✅ Working |
| Notifications (badge) | Navigate to notifications | `/notifications-new` | ✅ Working |

---

## 🔧 BUTTONS THAT NEED WIRING

### **Priority 1: Critical Missing Functionality**

1. **Follow/Unfollow Button (ProfilePage)** ❌
2. **Report/Block (Post Cards)** ❌
3. **Message Options Menu** ❌
4. **Post More Options Menu** ❌

### **Priority 2: Nice-to-Have**

5. **Add to Calendar (Event Details)** ❌
6. **Emoji Picker (Messages)** ❌
7. **Image Upload (Messages)** ❌

---

## 🚀 IMPLEMENTATION PLAN

Will implement all missing buttons with full integration.


