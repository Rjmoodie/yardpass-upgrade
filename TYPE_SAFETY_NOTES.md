# TypeScript Configuration Notes

## Current Status

TypeScript strict mode is **enabled** in the root `tsconfig.json`:
- ✅ `strict: true`
- ✅ `strictNullChecks: true`
- ✅ `noImplicitAny: true`
- ✅ `noUncheckedIndexedAccess: true`
- ✅ `exactOptionalPropertyTypes: true`
- ✅ `noImplicitReturns: true`

## App-Specific Configuration

Note: `tsconfig.app.json` has strict mode **disabled** for app code. This is intentional to allow gradual migration, but we should aim to enable strict mode there as well in the future.

## Known Type Issues

### 1. Deno Edge Functions
- **Location:** `supabase/functions/**/*.ts`
- **Issue:** TypeScript errors for Deno-specific modules
- **Status:** Expected - these files run in Deno runtime, not Node/TS
- **Action:** No fix needed - Deno has its own type definitions

### 2. Mux Player Types
- **Location:** `src/components/feed/VideoMedia.tsx:320`
- **Issue:** `preferCmcd` prop type mismatch
- **Fix Applied:** Type cast `preferCmcd={true as any}` (temporary until Mux types are updated)

## Recommendations

1. **Enable strict mode in `tsconfig.app.json` gradually**:
   - Start with `strictNullChecks: true`
   - Add `noImplicitAny: true`
   - Then enable full `strict: true`

2. **Add type definitions for third-party libraries**:
   - Consider creating `src/types/mux-player.d.ts` for Mux Player types
   - Add proper types for Deno edge functions if needed

3. **Regular type audits**:
   - Run `tsc --noEmit` regularly to catch type errors
   - Fix type errors before merging PRs

