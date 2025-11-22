# 🎭 Role-Based UI Experience Guide

## Overview
This document explains what users see and can do based on their role type.

---

## 📊 **Role Permission Matrix**

| Role | Can Scan | View Sales | Messaging | Manage Roles | Description |
|------|----------|------------|-----------|--------------|-------------|
| **Organizer** | ✅ | ✅ | ✅ | ✅ | Full event access |
| **Scanner** | ✅ | ❌ | ❌ | ❌ | Scan & validate tickets only |
| **Staff** | ✅ | ❌ | ❌ | ❌ | Event staff with scanning |
| **Volunteer** | ❌ | ❌ | ❌ | ❌ | Basic event participation |
| **Vendor** | ❌ | ❌ | ❌ | ❌ | Vendor/supplier access |
| **Guest** | ❌ | ❌ | ❌ | ❌ | Special guest access |

---

## 🎯 **User Journey: Scanner Invite**

### **1. Invitation Received** 📧
```
Subject: "Lend a hand at Music Festival 2025?"

Hi John,

We're looking for volunteers for Music Festival 2025 on 11/25/2025.

Roles: check-in, ushers, scanners
Shifts: 1–2 hours

[Sign Up Button]
```

### **2. Acceptance Page** (`/roles/accept?token=...`)
**User sees:**
- ✅ Event name and date
- ✅ Role being assigned (Scanner)
- ✅ What they can do
- ✅ "Accept Invitation" button

**What happens on accept:**
```typescript
// Creates record in events.event_roles
{
  event_id: "event-123",
  user_id: "user-456",
  role: "scanner",
  status: "active"
}
```

### **3. After Acceptance - What Scanner Sees** 👀

---

## 🧭 **Navigation Differences**

### **Regular Attendee Navigation:**
```
┌─────────────────────────────────────┐
│  Feed      Search    Tickets         │
│  Messages  Profile                   │
└─────────────────────────────────────┘
```

### **Scanner Navigation:**
```
┌─────────────────────────────────────┐
│  Feed      Search    Scanner  ← NEW!│
│  Messages  Profile                   │
└─────────────────────────────────────┘
```

**Code Reference:**
```typescript
// src/components/NavigationNewDesign.tsx
userRole === 'organizer'
  ? { id: 'scanner', icon: ScanLine, label: 'Scanner', path: '/scanner' }
  : { id: 'tickets', icon: Ticket, label: 'Tickets', path: '/tickets' }
```

---

## 📱 **Scanner Experience**

### **A. Scanner Page** (`/scanner`)

**Step 1: Select Event**
```
┌─────────────────────────────────────┐
│  Select Event to Scan               │
├─────────────────────────────────────┤
│  🎵 Music Festival 2025             │
│     Nov 25, 2025 • 150 tickets     │
│     [Select Event]                  │
└─────────────────────────────────────┘
```

**Step 2: Scanner View**
```
┌─────────────────────────────────────┐
│  🎥 [Camera View]                   │
│                                     │
│  Position QR code in frame          │
│                                     │
│  [Flash] [Manual Entry]             │
├─────────────────────────────────────┤
│  Recent Scans:                      │
│  ✅ John Doe - VIP                  │
│  ✅ Jane Smith - General            │
│  ❌ Invalid Ticket                  │
└─────────────────────────────────────┘
```

**Features:**
- ✅ Real-time QR scanning
- ✅ Manual ticket code entry
- ✅ Flash/torch control
- ✅ Scan history
- ✅ Success/fail feedback with haptics

---

## 🚫 **What Scanner CANNOT Access**

### **Blocked Pages/Features:**

#### **1. Event Dashboard** ❌
```
URL: /dashboard
Result: Not in navigation, redirects if accessed
```

#### **2. Event Analytics** ❌
```typescript
// Scanner cannot see:
canViewSales: false  // No revenue data
canMessage: false    // No attendee messaging
canManageRoles: false // Can't invite others
```

#### **3. Event Settings** ❌
- Cannot edit event details
- Cannot manage ticket tiers
- Cannot access attendee list
- Cannot view financial reports

#### **4. Organization Management** ❌
- Cannot access org dashboard
- Cannot manage org members
- Cannot view org wallet

---

## 🔒 **Security Enforcement**

### **Frontend (UI-Level)**
```typescript
// Navigation filtered by role
const navItems = userRole === 'organizer' 
  ? [...dashboardItems] 
  : [...attendeeItems];

// Component conditional rendering
{ROLE_MATRIX[role].canScan && <ScannerButton />}
{ROLE_MATRIX[role].canViewSales && <RevenueChart />}
```

### **Backend (Database RLS)**
```sql
-- Scanner can only SELECT their assigned events
CREATE POLICY "role_invites_select_authorized_only"
ON events.role_invites
FOR SELECT
USING (
  is_event_manager(event_id) OR  -- Organizer
  email = auth.user_email()      -- Invited recipient
);
```

### **API (Edge Function)**
```typescript
// Check user is event manager before allowing invite
const { data: isManager } = await supabase
  .rpc('is_event_manager', { p_event_id: event_id });

if (!isManager) {
  return new Response('Unauthorized', { status: 403 });
}
```

---

## 📋 **Role Comparison Examples**

### **Scenario: View Event Page**

**Organizer sees:**
```
┌─────────────────────────────────────┐
│  Music Festival 2025                │
│  [Edit Event] [View Dashboard]      │
│  Revenue: $5,234                    │
│  150 tickets sold                   │
│  [Manage Staff] [Message Attendees] │
└─────────────────────────────────────┘
```

**Scanner sees:**
```
┌─────────────────────────────────────┐
│  Music Festival 2025                │
│  [Scan Tickets]                     │
│  150 tickets sold                   │
└─────────────────────────────────────┘
```

**Attendee sees:**
```
┌─────────────────────────────────────┐
│  Music Festival 2025                │
│  [Buy Tickets]                      │
│  [View Details]                     │
└─────────────────────────────────────┘
```

---

### **Scenario: Try to Access Dashboard**

**Organizer:**
```
URL: /dashboard
Result: ✅ Shows full org dashboard
```

**Scanner:**
```
URL: /dashboard
Result: ❌ Redirects to /scanner or /
Message: "You don't have access to this page"
```

**Attendee:**
```
URL: /dashboard
Result: ❌ Redirects to /auth or /
```

---

## 🎬 **Complete Flow Example**

### **Scanner's Daily Workflow:**

1. **Login** → Lands on Feed (`/`)
2. **Click Scanner icon** → Goes to `/scanner`
3. **Select "Music Festival 2025"** → Scanner view opens
4. **Scan QR codes** → Validates tickets in real-time
5. **See scan history** → Recent validations shown
6. **Click Profile** → See their profile, NOT dashboard
7. **Try to access /dashboard** → Blocked/redirected

---

## 🔍 **Permission Checks in Code**

### **Example 1: Scanner Button**
```typescript
// Only show if user has scanning role for this event
const canScan = eventRoles.some(
  role => role.event_id === eventId && 
          ROLE_MATRIX[role.role].canScan
);

{canScan && <Button onClick={openScanner}>Scan Tickets</Button>}
```

### **Example 2: Revenue Display**
```typescript
// Only show revenue to organizers
const canViewSales = eventRoles.some(
  role => role.event_id === eventId && 
          ROLE_MATRIX[role.role].canViewSales
);

{canViewSales && (
  <Card>
    <CardTitle>Revenue</CardTitle>
    <CardContent>${totalRevenue}</CardContent>
  </Card>
)}
```

### **Example 3: Invite Management**
```typescript
// Only organizers can invite others
const canManageRoles = eventRoles.some(
  role => role.event_id === eventId && 
          ROLE_MATRIX[role.role].canManageRoles
);

{canManageRoles && <OrganizerRolesPanel eventId={eventId} />}
```

---

## 🚀 **Key Takeaways**

1. **Role = Permissions** → Each role has specific capabilities
2. **UI Adapts** → Navigation and features change based on role
3. **Multi-Layer Security** → Frontend + Backend + Database
4. **Clear Boundaries** → Users only see what they can do
5. **Good UX** → No broken links or "access denied" messages

---

## 📝 **For Developers**

When adding new features, always check:

```typescript
// ✅ Good: Check permissions
if (ROLE_MATRIX[userRole].canViewSales) {
  showRevenueChart();
}

// ❌ Bad: Hardcode role names
if (userRole === 'organizer') {
  showRevenueChart();
}
```

**Use the permission matrix, not role names!**

