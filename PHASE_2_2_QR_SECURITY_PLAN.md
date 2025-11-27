# 🔒 Phase 2.2.1: QR Code Security Hardening Plan

## 📊 Threat Model

### What We're Defending Against ✅

- ✅ **Double scans / race conditions** - Multiple scanners redeeming the same ticket simultaneously
- ✅ **Bulk abuse / spam scanning** - Automated scripts hammering the scanner endpoint
- ✅ **Obvious screenshot reuse** - Stale QR codes scanned long after issue or after event ends
- ✅ **Replay patterns** - Detecting suspicious scan patterns for investigation

### What's Out of Scope ❌

- ❌ **Advanced real-time theft** - Attacker using screenshot before owner arrives (requires device binding or rotating codes)
- ❌ **Perfect replay prevention** - Short-lived tokens help but can't prevent all screenshot attacks

**Key Insight:** We accept that `iat`-based checks are for detection and gross abuse prevention, not bulletproof theft protection. True "before-owner" replay protection would require device binding or short-lived rotating codes.

---

## 📊 Current State Assessment

### ✅ What Already Exists

1. **Signed QR Tokens** ✅
   - `issue-ticket-qr-token` function creates signed tokens
   - Format: `v1.{payload}.{signature}`
   - HMAC-SHA256 signing with `TICKET_QR_SIGNING_SECRET`
   - Scanner validates signed tokens

2. **Atomic Redemption** ✅
   - Uses `.is('redeemed_at', null)` guard
   - Prevents double-scan races (optimistic locking)
   - Returns duplicate error with timestamp

3. **Backwards Compatibility** ✅
   - Scanner supports both signed and legacy 8-character codes
   - Legacy codes still work

---

## 🎯 Hardening Improvements

### 1. **Timestamp-Based Replay Detection** 🔴 High Priority

#### Current Issue
- Signed tokens have expiration (`exp` field) but no replay window detection
- Screenshots can be reused immediately before expiration
- No time-based anomaly detection

#### Implementation Strategy

**Hard Reject:**
- `exp` still enforced as absolute token validity
- Very old tokens: `now() - iat > 2 hours` AND past event end time → hard reject
- Future tokens: `iat > now() + 5 minutes` (clock skew protection) → hard reject

**Soft Signal (Log Anomaly):**
- `now() - iat > 5 minutes` → log anomaly, but allow scan
- Used for detection and pattern analysis, not hard rejection
- Supports offline scenarios where device clocks may be inaccurate

**Clock Skew Handling:**
- Server time is source of truth
- Allow skew window: consider tokens invalid only if `iat > now() + 5m` (future-issued)
- Log `iat_age_seconds` in scan logs for analysis

**Key Principle:** `iat` checks are for detection and gross abuse, not bulletproof replay prevention.

---

### 2. **Explicit Row Locking (SELECT FOR UPDATE)** 🔴 High Priority

#### Current
- Uses optimistic locking (`.is('redeemed_at', null)`)
- Works, but explicit locking is safer and more predictable

#### Implementation: Database Function (Approach A - Strongly Preferred)

Create `redeem_ticket_atomic(p_ticket_id, p_scanner_user_id, p_event_id)` function:

- Uses explicit transaction with `SELECT FOR UPDATE` to lock row
- Checks `redeemed_at IS NULL` within transaction
- Sets `redeemed_at`, `status` atomically
- Returns structured status: `'REDEEMED' | 'ALREADY_REDEEMED' | 'NOT_FOUND' | 'INVALID_STATE'`
- Edge Function maps DB status to API responses

**Unified Redemption:**
- Both legacy 8-char codes and signed v1 tokens funnel into the same `redeem_ticket_atomic` function
- Ensures consistent redemption behavior (row locking, audit fields, error semantics)

**Approach B (Fallback):** Edge Function transaction - only if DB function approach is not feasible.

---

### 3. **Scanner Rate Limiting** 🟡 Medium Priority

#### Current
- No rate limiting per scanner
- Could allow spam scanning

#### Implementation Strategy

**Configurable Limits:**
- Make limits configurable via environment variables or config table
- Defaults: `10 scans/minute per scanner`, `200 scans/minute per event` (adjustable for big events)

**Rate Limit Keys:**
- Per scanner: `scanner:${event_id}:${scanner_user_id}`
- Per event (global): `scanner:event:${event_id}`
- Optional: IP-based for abuse detection: `scanner:ip:${ip_address}`

**What is a "Scanner"?**
- **Primary:** `user_id` (the authenticated scanner account)
- **Secondary:** `device_id` (if available for mobile apps)
- **Tertiary:** IP address (for abuse detection only, not primary enforcement)

**Distinguish Human vs Abuse:**
- Human realistic: normal flow (10/min per scanner is reasonable)
- Obvious abuse: scripts hammering (detect patterns, alert, rate limit more aggressively)

**Offline Tolerance:**
- Rate limiting must be server-side but tolerant of bursts
- If offline is critical, consider local caching with sync on reconnect

---

### 4. **Enhanced Anomaly Detection** 🟡 Medium Priority

#### Current
- Logs all scans
- No structured pattern detection

#### Implementation Strategy

**Log Metadata (Never Store Secrets):**
For each scan, log:
- `ticket_id`
- `event_id`
- `scanner_user_id`
- `scan_time`
- `iat_age_seconds` (if signed token)
- `result` (OK, ALREADY_REDEEMED, RATE_LIMITED, INVALID_SIGNATURE, etc.)
- `anomaly_flags` (array: `['old_iat', 'rapid_rescan', 'rate_limit_exceeded']`)

**Never Store:**
- Raw token contents
- At most: SHA256 hash of token (if absolutely necessary for dedup)

**Concrete Anomaly Rules:**
1. **Rapid Re-scans:** Same ticket scanned > 3 times in 10 seconds → flag `rapid_rescan`
2. **Multi-Scanner Collision:** Ticket scanned from 2+ different `scanner_user_id` within 30 seconds → flag `multi_scanner_collision`
3. **Invalid Signature Rate:** Invalid signatures > 10 per minute from a scanner → flag `invalid_signature_spam`
4. **Old Token:** `iat_age_seconds > 300` (5 minutes) → flag `old_iat`
5. **Rate Limit Exceeded:** Any rate limit hit → flag `rate_limit_exceeded`

**Alerting (Future):**
- Don't implement alerting right away
- Consistent flags in `scan_logs` make future analysis easier
- Can build dashboards/queries on top of structured flags

---

## 📋 Implementation Plan

### Step 1: Create Atomic Redemption Database Function

**File:** `supabase/migrations/20250128_qr_atomic_redemption.sql`

**Changes:**
1. Create `redeem_ticket_atomic(p_ticket_id, p_scanner_user_id, p_event_id)` function
2. Use `SELECT FOR UPDATE` for explicit row locking
3. Return structured status enum
4. Handle all validation (not found, wrong event, already redeemed, invalid state)

**Test Cases:**
- ✅ Two parallel scans of same ticket → only one returns success, other returns "already redeemed" with correct timestamp
- ✅ Legacy code and signed token → both funnel into same function, identical behavior
- ✅ Invalid ticket ID → returns "not found"
- ✅ Wrong event → returns "wrong event"

---

### Step 2: Update Scanner-Validate with Timestamp Replay Detection

**File:** `supabase/functions/scanner-validate/index.ts`

**Changes:**
1. Validate `iat` timestamp in signed tokens
2. Hard reject: `iat > now() + 5m` (future) or `iat < now() - 2h` AND past event end
3. Soft signal: log anomaly if `iat_age_seconds > 300` (5 min) but still allow scan
4. Log `iat_age_seconds` in scan logs
5. Replace optimistic locking with `redeem_ticket_atomic` RPC call

**Test Cases:**
- ✅ Token with `iat = now()` → success
- ✅ Token with `iat = 10 minutes ago` → success, but logged as `old_iat` anomaly
- ✅ Token with `iat = 3 hours ago` AND event ended → hard reject
- ✅ Token with `iat = future + 10 minutes` → hard reject (clock skew)

---

### Step 3: Add Scanner Rate Limiting

**File:** `supabase/functions/scanner-validate/index.ts`

**Changes:**
1. Import `checkRateLimit` from `_shared/rate-limiter.ts`
2. Check rate limit at start of function (per scanner + per event)
3. Return rate limit error if exceeded
4. Log rate limit events in scan_logs

**Configuration:**
- Env vars: `SCANNER_RATE_LIMIT_PER_MINUTE` (default: 10), `SCANNER_RATE_LIMIT_EVENT_PER_MINUTE` (default: 200)

**Test Cases:**
- ✅ Normal scanning (5 scans/min) → allowed
- ✅ Rapid scanning (15 scans/min) → rate limited after 10
- ✅ Multiple scanners (total 250 scans/min) → event limit hit after 200

---

### Step 4: Enhance Anomaly Detection

**File:** `supabase/functions/scanner-validate/index.ts`

**Changes:**
1. Call `detect_scan_anomaly` helper function
2. Add `anomaly_flags` array to scan_logs
3. Log metadata (not secrets) with structured fields
4. Implement 5 concrete anomaly rules

**Test Cases:**
- ✅ Rapid re-scans (5 in 5 seconds) → flag `rapid_rescan`
- ✅ Multi-scanner collision → flag `multi_scanner_collision`
- ✅ Old token scan → flag `old_iat`

---

## 🎯 Success Criteria

- ✅ Signed tokens have timestamp validation (hard reject for very old/future, soft signal for moderately old)
- ✅ Replay attempts are logged as anomalies with structured flags
- ✅ Very old scans (>2 hours + past event) are hard rejected
- ✅ Explicit row locking (`SELECT FOR UPDATE`) prevents race conditions
- ✅ Both legacy and signed codes use same redemption function
- ✅ Scanner rate limiting prevents spam (configurable limits)
- ✅ Anomaly detection logs structured metadata (no secrets)
- ✅ Backwards compatibility maintained
- ✅ **Anomaly count and rate limit events visible in logs/metrics**
- ✅ **No sensitive data (token contents) stored in logs**

---

## 🚀 Implementation Order

1. **Create atomic redemption DB function** (Step 1) - Foundation for all other improvements
2. **Update scanner-validate with timestamp detection** (Step 2) - Security enhancement
3. **Add rate limiting** (Step 3) - Abuse prevention
4. **Enhance anomaly detection** (Step 4) - Observability
5. **Mobile scanner UX improvements** (Step 5) - Better camera triggering & error handling

---

## 📝 Monitoring & Alerting (Future)

- Build dashboards on `scan_logs` with anomaly flags
- Alert on high anomaly rates per scanner
- Track rate limit hit frequency
- Monitor `old_iat` patterns (may indicate clock issues)

---

## 📱 5. Mobile Camera Scanning UX Improvements

### Current Issues

**Problem:** "Capacitor not available" error when triggering camera scanner on mobile
- Scanner assumes Capacitor is available without proper checks
- No graceful fallback if Capacitor isn't initialized
- Camera trigger may fail silently or with poor error messages
- No pre-flight checks for plugin availability

**User Impact:**
- Scanner fails to open on mobile devices
- Poor error messages ("capacitor not available" is not user-friendly)
- Manual code entry required when camera should work

---

### Implementation Strategy

#### 5.1 Pre-Flight Capacitor Availability Checks

**Before attempting to start camera:**
1. **Check Capacitor Platform Detection**
   - Verify `Capacitor.isNativePlatform()` returns valid result
   - Handle edge cases (web view, testing environments)
   - Log platform detection for debugging

2. **Check Plugin Availability**
   - Use `Capacitor.isPluginAvailable('BarcodeScanner')` before calling
   - Verify plugin is registered and initialized
   - Check if plugin was initialized in `capacitor-init.ts`

3. **Check Permissions**
   - Verify camera permissions before attempting scan
   - Request permissions proactively with clear messaging
   - Handle permission denial gracefully

**Implementation:**
```typescript
// In ScannerView.tsx
const checkCapacitorReady = async (): Promise<{ ready: boolean; error?: string }> => {
  // Check if Capacitor is available
  if (typeof Capacitor === 'undefined') {
    return { ready: false, error: 'Capacitor runtime not loaded' };
  }
  
  // Check if we're on native platform
  const isNative = Capacitor.isNativePlatform();
  if (!isNative) {
    // Web fallback is fine, return ready
    return { ready: true };
  }
  
  // Check if plugin is available
  if (!Capacitor.isPluginAvailable('BarcodeScanner')) {
    return { ready: false, error: 'Barcode scanner plugin not available' };
  }
  
  // Check camera permissions
  try {
    // Request permissions if needed (implementation depends on plugin)
    return { ready: true };
  } catch (err) {
    return { ready: false, error: `Permission denied: ${err.message}` };
  }
};
```

---

#### 5.2 Seamless Camera Trigger

**Improvements:**
1. **Lazy Load Scanner**
   - Only initialize Capacitor scanner when user explicitly triggers camera mode
   - Don't block on Capacitor initialization during component mount
   - Show loading state while checking availability

2. **Progressive Enhancement**
   - Start with manual entry always available
   - Enable camera button only after availability confirmed
   - Show clear UI state (disabled button vs. loading)

3. **Better Error Handling**
   - User-friendly error messages
   - Actionable error states ("Check permissions" vs. "Capacitor not available")
   - Auto-fallback to manual entry on failure

**Implementation:**
```typescript
// Enhanced startCamera with proper checks
const startCamera = useCallback(async () => {
  setInitializing(true);
  setCameraError(null);
  
  try {
    // Pre-flight checks
    const availability = await checkCapacitorReady();
    if (!availability.ready) {
      setCameraError(
        availability.error || 
        'Camera scanner is not available. Please use manual entry.'
      );
      setMode('manual');
      return;
    }
    
    // Rest of camera start logic...
  } catch (err) {
    setCameraError('Unable to start camera. Try manual entry.');
    setMode('manual');
  } finally {
    setInitializing(false);
  }
}, []);
```

---

#### 5.3 Capacitor Initialization Verification

**Check if Capacitor is properly initialized:**
1. Verify `initializeCapacitor()` was called at app startup
2. Check if BarcodeScanner plugin status is available
3. Add retry logic if plugin not ready (with timeout)
4. Log initialization state for debugging

**Implementation:**
```typescript
// Use capacitor-init state
import { getCapacitorState } from '@/lib/capacitor-init';

const checkPluginInitialized = async (): Promise<boolean> => {
  const state = getCapacitorState();
  if (!state.isNative) return true; // Web doesn't need plugin
  
  const scannerStatus = state.plugins.barcodeScanner;
  if (!scannerStatus.available) {
    console.warn('[Scanner] BarcodeScanner plugin not available');
    return false;
  }
  
  return true;
};
```

---

#### 5.4 Graceful Fallback Strategy

**Fallback Order:**
1. **Native Capacitor Scanner** (best UX)
   - If available and initialized → use `CapacitorBarcodeScanner`
   
2. **Web BarcodeDetector API** (good UX)
   - If on web and `BarcodeDetector` available → use getUserMedia
   
3. **Manual Entry** (always works)
   - Always show manual code entry as fallback
   - Make it prominent when camera fails

**UI States:**
- ✅ **Camera Available** - Show camera button enabled
- ⏳ **Checking** - Show loading spinner, disable camera button
- ⚠️ **Camera Unavailable** - Show manual entry, hide camera button
- ❌ **Error** - Show error message with manual entry option

---

#### 5.5 User-Friendly Error Messages

**Replace technical errors with actionable messages:**

| Technical Error | User-Friendly Message |
|----------------|----------------------|
| "Capacitor not available" | "Camera scanner is not available. Use manual code entry." |
| "Plugin not available" | "Scanning feature needs to be enabled. Try again or use manual entry." |
| "Permission denied" | "Camera permission is required. Please enable it in Settings." |
| "Camera start failed" | "Could not access camera. Check permissions or use manual entry." |

---

### 🎯 Success Criteria

- ✅ No "capacitor not available" errors in production
- ✅ Camera scanner opens seamlessly on mobile devices
- ✅ Clear error messages guide users to manual entry
- ✅ Pre-flight checks prevent failures before attempting scan
- ✅ Graceful fallback to manual entry when camera unavailable
- ✅ Loading states during Capacitor/plugin checks
- ✅ Camera button only enabled when scanner is actually ready

---

### 📋 Implementation Checklist

- [ ] Add `checkCapacitorReady()` function with comprehensive checks
- [ ] Add `checkPluginInitialized()` using capacitor-init state
- [ ] Enhance `startCamera()` with pre-flight checks
- [ ] Replace technical error messages with user-friendly ones
- [ ] Add loading states during availability checks
- [ ] Implement progressive enhancement (manual entry always available)
- [ ] Add retry logic for plugin initialization (optional)
- [ ] Test on iOS, Android, and web platforms
- [ ] Verify fallback to manual entry works in all error cases
- [ ] Add analytics to track scanner success/failure rates

---

### 📝 Test Cases

- ✅ **Happy Path:** Camera opens immediately on mobile
- ✅ **Capacitor Not Loaded:** Graceful fallback with clear message
- ✅ **Plugin Not Available:** Fallback to manual entry
- ✅ **Permission Denied:** Clear message with Settings link
- ✅ **Web Browser:** Uses BarcodeDetector API
- ✅ **Slow Initialization:** Shows loading state, then enables camera
- ✅ **Multiple Attempts:** Can retry after failure

---

**Ready to implement!** Starting with Step 1 (atomic redemption function).
