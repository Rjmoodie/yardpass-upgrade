# 🧪 Test Guest Access Redirect

## ✅ What Was Fixed

**Problem**: Guest verification completed but didn't redirect to tickets page

**Root Cause**: Conflicting navigation calls in `AuthExperience` and `TicketsRoute`

**Solution**: 
- Removed conflicting `navigate()` from `AuthExperience`
- Let parent components handle navigation via `onSuccess` callback
- Added fallback navigation for page layout (non-modal)
- Added small delay to ensure modal closes before navigation

---

## 🧪 Test Scenarios

### **Scenario 1: From Tickets Page (Landing Page)**
**Starting Point**: Navigate to `/tickets` while logged out

**Expected Flow**:
1. See "Your tickets, ready when you are" landing page
2. Click "**Access My Tickets**" button
3. Auth modal opens with **Guest Access** tab
4. Enter email/phone → Receive OTP → Enter OTP
5. ✅ **Modal closes**
6. ✅ **Redirects to `/tickets` with tickets loaded**
7. ✅ **Green banner shows:** "roderickmoodie@yahoo.com • Expires XX:XX"

**Where to Look**:
- `src/components/TicketsRoute.tsx` line 259-277 (onSuccess callback)

---

### **Scenario 2: From Bottom Navigation**
**Starting Point**: Click "Tickets" tab in bottom nav while logged out

**Expected Flow**:
1. Auth modal opens
2. Complete guest verification
3. ✅ **Modal closes**
4. ✅ **Navigates to `/tickets`**
5. ✅ **Tickets load**

**Where to Look**:
- `src/components/nav/BottomTabs.tsx` line 300-305 (already has navigation)

---

### **Scenario 3: From Auth Page Directly**
**Starting Point**: Navigate to `/auth` page

**Expected Flow**:
1. See full-page auth UI
2. Click **Guest Access** tab
3. Complete verification
4. ✅ **Navigates to `/tickets` (fallback navigation)**

**Where to Look**:
- `src/components/auth/AuthExperience.tsx` line 253-256 (fallback for page layout)

---

## 🐛 Debug Checklist

If redirect still not working, check:

### **1. Browser Console**
```javascript
// Check for errors
// Look for: "guest verify error"
// Look for: Navigation logs
```

### **2. localStorage**
```javascript
// In DevTools → Application → Local Storage
localStorage.getItem('ticket-guest-session')
// Should show: {"token":"...","exp":...,"scope":{...},"email":"..."}
```

### **3. Network Tab**
- ✅ `guest-tickets-verify` returns 200
- ✅ Response includes `{ token: "...", scope: {...} }`
- ✅ `tickets-list-guest` is called after redirect
- ✅ `tickets-list-guest` returns tickets array

### **4. React DevTools**
- Check `TicketsRoute` state
- Check if `guestSession` is populated
- Check if `TicketsPage` receives `guestToken` prop

---

## 🔧 Common Issues & Fixes

### **Issue 1: Modal doesn't close**
**Symptom**: Stuck on OTP verification screen after success

**Check**:
```typescript
// In AuthModal.tsx line 44-46
onAuthSuccess={() => {
  onSuccess?.();  // ← This should be called
  onClose();      // ← This should close modal
}}
```

### **Issue 2: Navigation doesn't happen**
**Symptom**: Modal closes but stays on same page

**Check**:
```typescript
// In TicketsRoute.tsx line 274-275
navigate('/tickets');  // ← Should be called 100ms after modal closes
```

### **Issue 3: Redirects but no tickets load**
**Symptom**: See green banner but "No tickets found"

**Possible Causes**:
- ✅ SQL views not created (run Step 1 from GUEST-ACCESS-FIX-GUIDE.md)
- ✅ Edge Functions not deployed (run `./deploy-all-guest-fixes.sh`)
- ✅ No tickets exist for that email/phone
- ✅ `tickets-list-guest` returning error (check Supabase logs)

---

## 📊 Expected Console Output

```javascript
// After OTP verification:
✅ [guest-tickets-verify] Session created successfully

// After redirect:
✅ Storage event dispatched

// After tickets page loads:
✅ [TicketsPage] Fetching guest tickets with token: abc123...
✅ [TicketsPage] Loaded 3 tickets
```

---

## ✅ Success Criteria

All of these should be true:

- [ ] Toast shows "Redirecting to your tickets..."
- [ ] Modal closes smoothly
- [ ] URL changes to `/tickets`
- [ ] Green guest session banner appears
- [ ] Email/phone shown in banner
- [ ] Expiry time shown
- [ ] "Sign Out" button visible
- [ ] Either tickets load OR "No tickets found" message
- [ ] Loading spinner shown during fetch
- [ ] No console errors

---

## 🚀 Quick Test Command

Open browser console and paste:

```javascript
// Check if guest session exists
const session = JSON.parse(localStorage.getItem('ticket-guest-session') || '{}');
console.log('Guest Session:', session);
console.log('Has Token:', !!session.token);
console.log('Expires:', new Date(session.exp).toLocaleString());

// Force navigate to tickets (if stuck)
window.location.href = '/tickets';
```

---

## 📝 Manual Test Script

1. **Clear State**: `localStorage.clear()` + hard refresh (Cmd+Shift+R)
2. **Go to tickets**: Click "Tickets" in bottom nav
3. **Open auth modal**: Click "Access My Tickets"
4. **Select method**: Phone or Email
5. **Enter contact**: Your email/phone
6. **Send code**: Click "Send access code"
7. **Check email/phone**: Get 6-digit OTP
8. **Enter OTP**: Type the code
9. **Click verify**: Watch for redirect
10. **Verify state**: Check banner + tickets

**Time to complete**: ~30 seconds

---

If you complete all steps and still have issues, provide:
1. Screenshot of the page after verification
2. Console errors (if any)
3. Network tab showing API calls
4. localStorage content for `ticket-guest-session`

