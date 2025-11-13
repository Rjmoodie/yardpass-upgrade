# Capacitor Quick Reference

## 🚀 Quick Commands

### Check for Updates
```bash
npm outdated | grep @capacitor
```

### Update All Capacitor Packages
```bash
npm install @capacitor/core@latest @capacitor/cli@latest @capacitor/ios@latest
npm install @capacitor/app@latest @capacitor/haptics@latest @capacitor/status-bar@latest
npm install @capacitor/keyboard@latest @capacitor/splash-screen@latest
npm install @capacitor/push-notifications@latest @capacitor/share@latest
npm install @capacitor/device@latest @capacitor/filesystem@latest
```

### Sync After Updates
```bash
npm run build
npx cap sync ios
```

### Open in Xcode (macOS only)
```bash
npx cap open ios
```

## 📦 Essential Packages

| Package | Current Version | Purpose |
|---------|----------------|---------|
| `@capacitor/core` | 7.4.3 | Core runtime |
| `@capacitor/cli` | 7.4.3 | CLI tools |
| `@capacitor/ios` | 7.4.3 | iOS platform |
| `@capacitor/keyboard` | 7.0.3 | Keyboard handling |
| `@capacitor/status-bar` | 7.0.3 | Status bar control |
| `@capacitor/haptics` | 7.0.2 | Haptic feedback |
| `@capacitor/splash-screen` | 7.0.3 | Launch screen |
| `@capacitor/push-notifications` | 7.0.3 | Push notifications |
| `@capacitor/share` | 7.0.2 | Native sharing |
| `@capacitor/app` | 7.1.0 | App lifecycle |

## 🔑 Key Configuration Files

### capacitor.config.ts
```typescript
appId: 'com.liventix.app'
appName: 'Liventix'
```

### iOS Initialization
`src/lib/ios-capacitor.ts` - Status bar, keyboard, and theme handling

### Haptics Hook
`src/hooks/useHaptics.ts` - Tactile feedback utilities

## 🧪 Testing Checklist

After updates:
- [ ] Build completes without errors (`npm run build`)
- [ ] Sync runs successfully (`npx cap sync ios`)
- [ ] Status bar theme changes work
- [ ] Keyboard resizing works on inputs
- [ ] Haptic feedback triggers properly
- [ ] Splash screen shows/hides correctly
- [ ] Push notifications can be configured
- [ ] Share sheet opens from app

## 📱 iOS-Specific Features

### Status Bar
- Dynamically updates with theme changes
- Overlay mode enabled for full-screen experience
- Light/Dark styles match system preferences

### Keyboard
- Native resize mode
- DOM class toggle on show/hide
- Inputs stay visible when keyboard appears

### Haptics
```typescript
const { impactLight, impactMedium, impactHeavy,
        notificationSuccess, notificationWarning, notificationError } = useHaptics();
```

## 🚨 Common Issues

### Build fails after update
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

### iOS sync fails
```bash
# Remove iOS folder and re-add platform
rm -rf ios
npx cap add ios
npm run build
npx cap sync ios
```

### Keyboard plugin not working
- Verify `@capacitor/keyboard` is in package.json
- Check imports in `ios-capacitor.ts`
- Ensure `Keyboard.setResizeMode({ mode: 'native' })` is called

## 📚 Documentation Links

- [Capacitor Docs](https://capacitorjs.com/docs)
- [iOS Configuration](https://capacitorjs.com/docs/ios/configuration)
- [Capacitor Plugins](https://capacitorjs.com/docs/plugins)
- [API Reference](https://capacitorjs.com/docs/apis)

## 🔄 Update Workflow

1. Check for updates: `npm outdated | grep @capacitor`
2. Update packages (see commands above)
3. Run build: `npm run build`
4. Sync native projects: `npx cap sync ios`
5. Test on device or simulator
6. Update version in `docs/capacitor-upgrade-summary.md`
7. Commit changes

---

Last Updated: October 8, 2025


