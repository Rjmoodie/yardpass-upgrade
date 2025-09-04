# Manual QA Checklist - Share System

## Web (Desktop)

### Event Cards
- [ ] **Event card share button visible**: Share button present on each event card
- [ ] **Click triggers fallback modal**: Modal appears (since desktops typically don't support navigator.share)
- [ ] **Copy Link button works**: URL copied to clipboard successfully
- [ ] **Deep link format**: URL contains `utm_source=share&utm_medium=app&utm_campaign=event`
- [ ] **WhatsApp button**: Opens `wa.me` with composed text and URL
- [ ] **Messages/SMS button**: Opens SMS app with pre-filled message
- [ ] **Share via... button**: Falls back to copy link if Web Share API unavailable

### Organizer Pages
- [ ] **Share button present**: Visible on organization dashboard/profile
- [ ] **Correct UTM campaign**: URL contains `utm_campaign=org`
- [ ] **Proper metadata**: Title shows organization name

### User Profiles
- [ ] **Share button present**: Visible on user profile pages
- [ ] **Correct UTM campaign**: URL contains `utm_campaign=user`
- [ ] **Handle in URL**: URL uses `/u/{handle}` format

## Mobile Browser

### iOS Safari
- [ ] **Native share sheet opens**: System share sheet appears when clicking share
- [ ] **No fallback modal**: Should go directly to native share
- [ ] **App options visible**: iMessage, Mail, WhatsApp, etc. available
- [ ] **Link preview works**: Shared link shows rich preview in iMessage

### Android Chrome
- [ ] **Native share sheet opens**: Android share sheet appears
- [ ] **Multiple apps available**: WhatsApp, Telegram, Gmail, etc.
- [ ] **Rich preview**: Shared links show title and image in supported apps

## Capacitor (iOS/Android)

### Native App
- [ ] **Capacitor share works**: Native share sheet opens reliably
- [ ] **No crashes on dismiss**: App doesn't crash when share is cancelled
- [ ] **Re-open works**: Can open share multiple times
- [ ] **Deep links work**: Shared links open back into app if installed

## Analytics Verification

### Event Tracking
- [ ] **share_intent fired**: Analytics event triggered on share button click
- [ ] **share_completed fired**: Analytics event triggered after successful share
- [ ] **Correct channel**: `native`, `web_api`, `fallback_modal`, or `copy`
- [ ] **Entity metadata**: Event ID, type, and other relevant data included

## Rich Preview Testing

### iMessage
- [ ] **Event links**: Show event title, date, and cover image
- [ ] **Org links**: Show organization name and description
- [ ] **User links**: Show user name and profile info

### WhatsApp
- [ ] **Link preview loads**: Rich preview appears below message
- [ ] **Image displays**: Cover images load correctly
- [ ] **Title/description correct**: Matches intended share text

### Twitter/X
- [ ] **Twitter Card works**: Large image card displays
- [ ] **Meta tags present**: og:title, og:description, og:image all populated

## Edge Cases

### Missing Data
- [ ] **No event image**: Falls back to default OG image
- [ ] **Long titles**: Truncated appropriately for different platforms
- [ ] **Empty descriptions**: Default text used

### Connectivity
- [ ] **Offline mode**: Share button disabled with tooltip when offline
- [ ] **Slow connections**: Loading states handled gracefully

### Permissions
- [ ] **Clipboard blocked**: Graceful fallback when clipboard access denied
- [ ] **Share API blocked**: Falls back to modal when permissions denied

## Console Logs (Development Mode)

### Debug Output
- [ ] **Entry logs**: `[Share] sharePayload entry:` appears
- [ ] **Path selection**: Logs show which share method was chosen
- [ ] **Modal fallback**: `[Share] Opening fallback modal` when applicable
- [ ] **URL generation**: `[ShareLinks] buildShareUrl output:` shows correct URLs

## Performance

### Load Times
- [ ] **Share button responsive**: No delay when clicking share buttons
- [ ] **Modal opens quickly**: Fallback modal appears within 200ms
- [ ] **Native sheet fast**: System share sheet opens without lag

### Memory
- [ ] **No memory leaks**: Multiple share actions don't accumulate memory
- [ ] **Modal cleanup**: Share modal properly unmounts when closed

## Regression Testing

### Existing Functionality
- [ ] **Feed still works**: Main feed functionality unchanged
- [ ] **Event details load**: Event pages work normally
- [ ] **Navigation intact**: Bottom navigation still functional
- [ ] **User auth works**: Login/logout still functional

### UI Consistency
- [ ] **Button styles match**: Share buttons use consistent design system
- [ ] **Modal theme correct**: Share modal matches app theme
- [ ] **Dark mode support**: Share functionality works in both light/dark modes

## Cross-Platform

### URL Handling
- [ ] **iOS universal links**: `yardpass.com` links open app when installed
- [ ] **Android app links**: Deep links handled correctly
- [ ] **Web fallback**: Links open in browser when app not installed

### Share Content
- [ ] **Text formatting**: Share text appears correctly across platforms
- [ ] **URL encoding**: Special characters in URLs handled properly
- [ ] **Length limits**: Respects platform-specific character limits

---

## Test Environment Setup

1. **Local Development**: `npm run dev` with console open
2. **Mobile Testing**: Use device or Chrome DevTools mobile emulation
3. **Analytics**: Enable PostHog or check console for analytics events
4. **Network**: Test with throttled connections in DevTools

## Automated Test Coverage

- [ ] **Unit tests pass**: `npm test` completes successfully
- [ ] **E2E tests pass**: `npm run test:e2e` completes successfully
- [ ] **No TypeScript errors**: Build succeeds without warnings