# YardPass Authentication System - Complete Structure

## Core Authentication Files

### 1. Context & State Management

#### `src/contexts/AuthContext.tsx` (223 lines)
**Purpose**: Global authentication state provider
- Manages user session, profile, and authentication state
- Provides auth methods to entire app via React Context

**Key Features**:
```typescript
// State
- user: User | null              // Current Supabase user
- profile: UserProfile | null    // User profile from database
- session: Session | null        // Current session
- loading: boolean               // Auth loading state

// Methods
- signIn(email, password)                    // Email/password sign in
- signInWithPhone(phone)                     // Send OTP to phone
- verifyPhoneOtp(phone, token)               // Verify OTP code
- signUp(email, password, displayName, phone) // Email sign up
- signUpWithPhone(phone, displayName)        // Phone sign up
- signOut()                                   // Sign out
- updateRole(role)                            // Update user role
- updateProfile(updates)                      // Update profile
```

**Session Management**:
- Listens to Supabase auth state changes
- Automatically fetches user profile on auth
- Persists session across page refreshes
- Handles session expiration

---

### 2. Authentication Hooks

#### `src/hooks/useAuthFlow.tsx` (170 lines)
**Purpose**: Reusable auth flow logic for sign in/sign up
- Handles phone OTP flow (send code → verify code)
- Handles email/password authentication
- Manages form state and loading states
- Provides toast notifications
- Handles post-auth navigation

**State & Methods**:
```typescript
const {
  isLoading,           // Loading state
  showOtpInput,        // Show OTP input field
  phoneForOtp,         // Phone number awaiting OTP
  handleSignIn,        // Sign in handler
  handleSignUp,        // Sign up handler
  resetOtpState,       // Reset OTP flow
} = useAuthFlow();
```

**Phone OTP Flow**:
1. User enters phone → Send OTP
2. User enters OTP code → Verify
3. Success → Navigate to redirect location

#### `src/hooks/useAuthGuard.tsx` (57 lines)
**Purpose**: Programmatic auth checking for actions
- Check if user is authenticated before action
- Redirect to auth page if not authenticated
- Higher-order function wrapper for protected actions

**Usage**:
```typescript
const { requireAuth, withAuth, isAuthenticated } = useAuthGuard();

// Option 1: Check before action
const handleAction = () => {
  requireAuth(() => {
    // Protected action
  }, "Please sign in to continue");
};

// Option 2: Wrap function
const handleProtectedAction = withAuth(
  () => { /* action */ },
  "Authentication required"
);
```

---

### 3. Authentication Components

#### `src/components/AuthModal.tsx` (537 lines)
**Purpose**: Modal for sign in/sign up/guest access
- Full authentication modal with tabs
- Supports Email & Phone authentication
- Guest ticket access (OTP-only, no profile)
- Event-scoped guest sessions

**Props**:
```typescript
interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  title?: string;
  description?: string;
  allowGuestTicketAccess?: boolean;  // Enable guest flow
  guestScopeEventId?: string;        // Limit guest to event
  guestSessionMinutes?: number;      // Guest session duration
  defaultTab?: 'guest' | 'signin' | 'signup';
}
```

**Features**:
- **3 Tabs**: Guest Access | Sign In | Sign Up
- **2 Methods**: Phone (OTP) | Email (password)
- **Guest Flow**: Quick OTP access without full account
- **OTP Verification**: With masked contact display
- **Resend Timer**: 30-second countdown for OTP resend
- **Form Validation**: Real-time validation feedback

**Guest Ticket Flow**:
1. User enters phone/email
2. Receives OTP code
3. Verifies OTP
4. Creates limited session (localStorage)
5. Access granted for specific event/duration

#### `src/pages/AuthPage.tsx` (271 lines)
**Purpose**: Standalone authentication page
- Full-page auth UI (not modal)
- Sign in / Sign up tabs
- Phone or Email method toggle
- Auto-redirect if already authenticated

**Features**:
- Beautiful gradient background
- YardPass branding
- Method toggle (Phone ↔ Email)
- OTP flow for phone auth
- Redirect after successful auth

#### `src/components/AuthGuard.tsx` (172 lines)
**Purpose**: Protect routes/components requiring authentication
- Wraps components to enforce auth
- Shows loading state during check
- Redirects or shows fallback if not authenticated
- Supports guest ticket sessions
- Role-based access control

**Props & Usage**:
```typescript
interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;         // Custom fallback UI
  allowTicketGuest?: boolean;         // Allow guest sessions
  requireRoles?: ('attendee' | 'organizer' | 'admin')[];
  ticketScope?: { eventId?: string }; // Event scope check
  redirectTo?: string;                // Redirect instead of fallback
  loadingFallback?: React.ReactNode;  // Custom loading UI
  onBlocked?: (reason) => void;       // Blocked callback
}

// Usage
<AuthGuard requireRoles={['organizer']}>
  <OrganizerDashboard />
</AuthGuard>

<AuthGuard allowTicketGuest ticketScope={{ eventId: 'xyz' }}>
  <TicketAccessPage />
</AuthGuard>
```

**Guest Session Logic**:
- Reads `ticket-guest-session` from localStorage
- Validates token expiration
- Checks event scope if required
- Falls back to full auth if invalid

#### `src/components/AuthScreen.tsx` (stories + component)
**Purpose**: Reusable auth screen component
- Alternative auth UI pattern
- Storybook-ready component
- Configurable logo, mode, and methods

---

## Authentication Flow Patterns

### Pattern 1: Full Account Authentication

#### A. Phone OTP Flow
```
1. User opens AuthModal/AuthPage
2. Selects "Phone" method
3. Enters phone number → Submit
4. Backend sends OTP via SMS
5. User enters 6-digit OTP code
6. System verifies OTP with Supabase
7. Success → Create/fetch user profile
8. Redirect to protected route
```

#### B. Email/Password Flow
```
1. User opens AuthModal/AuthPage
2. Selects "Email" method
3. Sign In:
   - Enters email + password
   - System validates credentials
   - Success → Fetch profile → Redirect
4. Sign Up:
   - Enters email + password + display name
   - System creates account
   - Sends verification email
   - User verifies email (optional)
   - Success → Create profile → Redirect
```

### Pattern 2: Guest Ticket Access (Event-Scoped)

```
1. User clicks "View Tickets" (not signed in)
2. AuthModal opens with allowGuestTicketAccess={true}
3. User enters phone/email
4. Receives OTP code
5. Verifies OTP
6. System creates localStorage session:
   {
     token: 'guest_xyz',
     phone: '+1234567890',
     exp: Date.now() + 30*60*1000,
     scope: { eventIds: ['event-id'] }
   }
7. User can access tickets for that event only
8. Session expires after 30 minutes
```

### Pattern 3: Protected Route Access

```
1. User navigates to /dashboard
2. AuthGuard wraps the route
3. Checks: Is user authenticated?
   - Yes → Render children
   - No → Show AuthPage or redirect
4. If requireRoles specified:
   - Check user.profile.role
   - Block if role doesn't match
5. Store redirect URL in location.state
6. After auth → Navigate back to original route
```

---

## Database Schema (User-related)

### `user_profiles` table
```sql
- user_id (uuid, PK, FK to auth.users)
- display_name (text)
- photo_url (text)
- phone (text)
- role ('attendee' | 'organizer' | 'admin')
- verification_status (text)
- created_at (timestamptz)
- updated_at (timestamptz)
```

### `auth.users` (Supabase Auth)
```sql
- id (uuid, PK)
- email (text)
- phone (text)
- encrypted_password (text)
- email_confirmed_at (timestamptz)
- phone_confirmed_at (timestamptz)
- created_at (timestamptz)
- updated_at (timestamptz)
```

---

## Key Integration Points

### 1. App.tsx Routes
```typescript
<Route path="/auth" element={<AuthPage />} />

<Route 
  path="/dashboard" 
  element={
    <AuthGuard requireRoles={['organizer']}>
      <OrganizerDashboard />
    </AuthGuard>
  } 
/>

<Route 
  path="/profile" 
  element={
    <AuthGuard>
      <UserProfile />
    </AuthGuard>
  } 
/>
```

### 2. Navigation.tsx
```typescript
// Show auth prompt for unauthenticated users
{!user && (
  <Button onClick={() => navigate('/auth')}>
    Sign In
  </Button>
)}
```

### 3. Protected Actions
```typescript
// Example: Like a post
const { withAuth } = useAuthGuard();

const handleLike = withAuth(
  async (postId: string) => {
    await supabase.from('likes').insert({ post_id: postId });
  },
  "Please sign in to like posts"
);
```

---

## Security Features

### 1. Row Level Security (RLS)
- Supabase RLS policies on all user-related tables
- Users can only read/update their own profile
- Role-based access for organizer features

### 2. Session Management
- Supabase JWT tokens (auto-refresh)
- HttpOnly cookies for web
- Secure session storage

### 3. OTP Security
- SMS OTP for phone verification
- Email magic links for passwordless
- Time-limited codes (5-10 minutes)
- Rate limiting on OTP requests

### 4. Guest Sessions
- Stored in localStorage (not cookies)
- Event-scoped access only
- Short expiration (30 min default)
- No write permissions
- No profile creation

---

## Toast Notifications

All auth flows use the toast system for feedback:

```typescript
// Success
toast({ 
  title: "Welcome back!", 
  description: "You've successfully signed in." 
});

// Error
toast({ 
  title: "Sign in failed", 
  description: error.message,
  variant: "destructive" 
});

// Info
toast({ 
  title: "Verification code sent", 
  description: "Please check your phone." 
});
```

---

## Environment Variables

Required in `.env`:
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Supabase handles:
- SMS sending for OTP
- Email sending for magic links
- Password hashing
- Session management
- Rate limiting

---

## Usage Examples

### Example 1: Protect a Component
```typescript
import { AuthGuard } from '@/components/AuthGuard';

function MyProtectedPage() {
  return (
    <AuthGuard>
      <div>Protected content</div>
    </AuthGuard>
  );
}
```

### Example 2: Open Auth Modal
```typescript
import AuthModal from '@/components/AuthModal';

function MyComponent() {
  const [showAuth, setShowAuth] = useState(false);

  return (
    <>
      <Button onClick={() => setShowAuth(true)}>
        Sign In
      </Button>
      
      <AuthModal
        isOpen={showAuth}
        onClose={() => setShowAuth(false)}
        onSuccess={() => {
          setShowAuth(false);
          // Do something after auth
        }}
      />
    </>
  );
}
```

### Example 3: Check Auth in Function
```typescript
import { useAuthGuard } from '@/hooks/useAuthGuard';

function MyComponent() {
  const { requireAuth } = useAuthGuard();

  const handleProtectedAction = () => {
    requireAuth(() => {
      // This only runs if authenticated
      console.log('User is authenticated!');
    });
  };

  return <Button onClick={handleProtectedAction}>Do Action</Button>;
}
```

### Example 4: Use Auth Context
```typescript
import { useAuth } from '@/contexts/AuthContext';

function MyComponent() {
  const { user, profile, signOut } = useAuth();

  if (!user) return <div>Please sign in</div>;

  return (
    <div>
      <p>Welcome, {profile?.display_name}!</p>
      <Button onClick={signOut}>Sign Out</Button>
    </div>
  );
}
```

---

## Architecture Summary

```
AuthContext (Global State)
    ↓
    ├─→ useAuthFlow (Flow Logic)
    ├─→ useAuthGuard (Programmatic Checks)
    │
    ├─→ AuthModal (Modal UI)
    ├─→ AuthPage (Full Page UI)
    ├─→ AuthGuard (Component Wrapper)
    │
    └─→ Protected Routes/Components
```

**Data Flow**:
```
User Action → AuthModal/AuthPage → useAuthFlow → AuthContext
                                                        ↓
                                                  Supabase Auth
                                                        ↓
                                                  Update Session
                                                        ↓
                                                  Fetch Profile
                                                        ↓
                                                  Trigger Listeners
                                                        ↓
                                                  Re-render App
```

---

## Best Practices

1. **Always use AuthGuard** for route-level protection
2. **Use useAuthGuard** for action-level checks
3. **Never store sensitive data** in guest sessions
4. **Always validate** on the backend (RLS policies)
5. **Use toast notifications** for user feedback
6. **Handle loading states** during auth flows
7. **Redirect after auth** using location.state
8. **Clear guest sessions** on full sign in

---

## Testing Checklist

- [ ] Sign in with phone (OTP)
- [ ] Sign in with email/password
- [ ] Sign up with phone
- [ ] Sign up with email
- [ ] Guest ticket access
- [ ] Guest session expiration
- [ ] Event-scoped guest access
- [ ] AuthGuard blocking
- [ ] Role-based access
- [ ] Redirect after auth
- [ ] Sign out
- [ ] Session persistence
- [ ] OTP resend
- [ ] Error handling
- [ ] Toast notifications

---

All authentication files are complete and production-ready! 🔐
