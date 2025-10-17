# 🔧 Guest Ticket Access Debug Guide

## 🚨 **Current Issues Identified**

### **1. Role State Persistence Issue** ✅ FIXED
- **Problem**: When users signed out, role state wasn't properly reset
- **Impact**: App would show organizer view even after sign out
- **Fix**: Enhanced `AuthContext.signOut()` to reset all auth state

### **2. Guest Session Management Issues**
- **Problem**: Guest sessions may not be properly cleared on sign out
- **Impact**: Conflicting authentication states
- **Fix**: Clear guest sessions on user sign out

### **3. Navigation Role State Issues**
- **Problem**: Navigation role derived from cached state
- **Impact**: Wrong navigation items shown after sign out
- **Fix**: Enhanced role derivation to check user authentication

## 🔍 **Debugging Steps**

### **Step 1: Check Guest Session State**
```typescript
// Check localStorage for guest session
const guestSession = localStorage.getItem('ticket-guest-session');
console.log('Guest session:', guestSession);

// Check if session is expired
if (guestSession) {
  const { exp } = JSON.parse(guestSession);
  const isExpired = Date.now() > exp;
  console.log('Session expired:', isExpired);
}
```

### **Step 2: Verify Auth State**
```typescript
// Check current auth state
const { user, profile, session } = useAuth();
console.log('Auth state:', { 
  hasUser: !!user, 
  hasProfile: !!profile, 
  hasSession: !!session,
  userRole: profile?.role 
});
```

### **Step 3: Check Guest Ticket API**
```bash
# Test guest ticket endpoint
curl -X POST https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1/tickets-list-guest \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"token": "GUEST_TOKEN_HERE"}'
```

## 🛠️ **Fixes Applied**

### **1. Enhanced Sign Out Process**
```typescript
// Before
const signOut = async () => {
  await supabase.auth.signOut();
  setProfile(null);
};

// After  
const signOut = async () => {
  await supabase.auth.signOut();
  setProfile(null);
  setUser(null);
  setSession(null);
  // Clear guest sessions
  localStorage.removeItem('ticket-guest-session');
};
```

### **2. Improved Role State Management**
```typescript
// Before
const userRole: UserRole = (profile?.role as UserRole) || 'attendee';

// After
const userRole: UserRole = user ? ((profile?.role as UserRole) || 'attendee') : 'attendee';
```

### **3. Guest Session Cleanup**
```typescript
// Clear guest sessions when user signs out
const clearGuestSessions = () => {
  localStorage.removeItem('ticket-guest-session');
  // Clear any other guest-related storage
};
```

## 🧪 **Testing Scenarios**

### **Test 1: Organizer Sign Out**
1. Sign in as organizer
2. Verify organizer dashboard is accessible
3. Sign out
4. **Expected**: App resets to attendee view
5. **Verify**: Navigation shows attendee items only

### **Test 2: Guest Session Cleanup**
1. Create guest ticket session
2. Sign in as regular user
3. Sign out
4. **Expected**: Guest session is cleared
5. **Verify**: No conflicting auth states

### **Test 3: Guest Ticket Access**
1. Purchase ticket as guest (no account)
2. Access tickets via guest session
3. **Expected**: Can view tickets for 30 minutes
4. **Verify**: Session expires properly

## 🚀 **Additional Improvements**

### **1. Enhanced Guest Session Management**
```typescript
// Add to AuthContext
const clearAllSessions = () => {
  // Clear Supabase session
  supabase.auth.signOut();
  
  // Clear local auth state
  setProfile(null);
  setUser(null);
  setSession(null);
  
  // Clear guest sessions
  localStorage.removeItem('ticket-guest-session');
  
  // Clear any other cached data
  localStorage.removeItem('search_recent');
  localStorage.removeItem('user_preferences');
};
```

### **2. Better Error Handling**
```typescript
// Enhanced error handling for guest access
const handleGuestAccessError = (error: any) => {
  console.error('Guest access error:', error);
  
  if (error.status === 401) {
    // Session expired
    localStorage.removeItem('ticket-guest-session');
    toast({
      title: 'Session expired',
      description: 'Please verify your contact again to continue.',
      variant: 'destructive'
    });
  } else if (error.status === 404) {
    // No tickets found
    toast({
      title: 'No tickets found',
      description: 'No tickets found for this contact.',
      variant: 'destructive'
    });
  }
};
```

### **3. Session Status Indicators**
```typescript
// Add session status to UI
const SessionStatus = () => {
  const { user } = useAuth();
  const { session: guestSession } = useGuestTicketSession();
  
  if (user) {
    return <div className="text-green-600">✓ Signed in</div>;
  } else if (guestSession?.isActive) {
    const timeLeft = Math.max(0, guestSession.exp - Date.now());
    const minutes = Math.floor(timeLeft / 60000);
    return <div className="text-blue-600">Guest session: {minutes}m left</div>;
  } else {
    return <div className="text-gray-500">Not signed in</div>;
  }
};
```

## 📊 **Monitoring & Logging**

### **Debug Logging**
```typescript
// Add to AuthContext
const debugAuthState = () => {
  console.group('🔍 Auth State Debug');
  console.log('User:', user?.id || 'null');
  console.log('Profile:', profile?.role || 'null');
  console.log('Session:', session?.access_token ? 'active' : 'null');
  console.log('Guest Session:', localStorage.getItem('ticket-guest-session') ? 'active' : 'none');
  console.groupEnd();
};

// Call on auth state changes
useEffect(() => {
  debugAuthState();
}, [user, profile, session]);
```

### **Error Tracking**
```typescript
// Track guest access errors
const trackGuestError = (error: any, context: string) => {
  console.error(`Guest access error in ${context}:`, error);
  
  // Send to analytics if available
  if (typeof gtag !== 'undefined') {
    gtag('event', 'guest_access_error', {
      error_type: error.status || 'unknown',
      context,
      error_message: error.message
    });
  }
};
```

## ✅ **Expected Results**

After implementing these fixes:

1. **✅ Clean Sign Out**: Users properly reset to attendee view
2. **✅ No Role Persistence**: Previous roles don't persist after sign out  
3. **✅ Guest Session Cleanup**: No conflicting authentication states
4. **✅ Proper Navigation**: Navigation items update correctly
5. **✅ Better Debugging**: Clear visibility into auth state issues

## 🔄 **Next Steps**

1. **Test thoroughly** with different user types
2. **Monitor logs** for any remaining issues
3. **Add analytics** to track auth state problems
4. **Implement session recovery** for edge cases
5. **Add user feedback** for auth state issues

---

**Status**: Core fixes implemented ✅ | Testing in progress 🧪  
**Last Updated**: January 2025
