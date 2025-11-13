# 🚀 Cloud iOS Build Setup for Liventix

This guide helps you set up cloud-based iOS building for your Liventix app using your older Mac.

## 🎯 Quick Comparison

| Platform | Cost | Setup Time | Features | Best For |
|----------|------|------------|----------|----------|
| **GitHub Actions** | Free (public repos) | 15 min | CI/CD, Artifacts | Most users |
| **Azure DevOps** | Free tier available | 20 min | Enterprise features | Microsoft ecosystem |
| **Codemagic** | $95/month | 10 min | Mobile-focused | Professional mobile dev |

---

## 🥇 Option 1: GitHub Actions (Recommended)

### **Prerequisites:**
- GitHub repository (free)
- Apple Developer Account ($99/year)
- 30 minutes setup time

### **Step 1: Repository Setup**
```bash
# Push your code to GitHub if not already there
git remote add origin https://github.com/yourusername/liventix.git
git push -u origin main
```

### **Step 2: Configure GitHub Secrets**
Go to your GitHub repo → Settings → Secrets and variables → Actions

Add these secrets:
```
VITE_SUPABASE_URL=https://yieslxnrfeqchbcmgavz.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_SUPABASE_FUNCTIONS_URL=https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_key
VITE_MAPBOX_ACCESS_TOKEN=pk.your_mapbox_token
APPLE_TEAM_ID=your_apple_team_id
```

### **Step 3: Apple Developer Setup**
1. **Create App ID:**
   - Go to [Apple Developer Portal](https://developer.apple.com)
   - Certificates, Identifiers & Profiles → Identifiers
   - Create new App ID: `com.liventix.app`

2. **Create Development Certificate:**
   - Generate on your Mac: `security find-identity -v -p codesigning`
   - Or create new certificate in portal

### **Step 4: Update Capacitor Config**
```typescript
// capacitor.config.ts
const config: CapacitorConfig = {
  appId: 'com.liventix.app', // Changed from the long ID
  appName: 'Liventix',       // Changed from liventix-upgrade
  webDir: 'dist',
  // ... rest of config
};
```

### **Step 5: First Build**
```bash
# Commit the workflow file
git add .github/workflows/ios-build.yml
git commit -m "Add iOS build workflow"
git push

# The build will start automatically!
```

### **Step 6: Download & Test**
1. Go to Actions tab in GitHub
2. Click on latest build
3. Download the iOS artifact
4. Install on device via Xcode or TestFlight

---

## 🔷 Option 2: Azure DevOps

### **Setup Steps:**
1. **Create Azure DevOps Project:**
   - Go to [dev.azure.com](https://dev.azure.com)
   - Create new project
   - Import your GitHub repo

2. **Configure Variable Group:**
   - Pipelines → Library → Variable groups
   - Create "Liventix-Secrets" group
   - Add all environment variables

3. **Setup Pipeline:**
   - Pipelines → Create pipeline
   - Choose existing Azure Pipelines YAML
   - Select `azure-pipelines.yml`

4. **First Build:**
   - Run pipeline
   - Download artifacts from build results

---

## 🎯 Option 3: Codemagic (Premium)

### **Setup Steps:**
1. **Sign up:** [codemagic.io](https://codemagic.io)
2. **Connect Repository:** Link your GitHub repo
3. **Configure App:** Upload `codemagic.yaml`
4. **Add Certificates:** Upload your Apple certificates
5. **First Build:** Trigger build from dashboard

---

## 🛠️ Local Development on Your Mac

Even with cloud building, you can still develop locally:

### **Install Dependencies:**
```bash
# Install Node.js 18+ if not installed
# Install Capacitor CLI globally
npm install -g @capacitor/cli

# Install project dependencies
npm install

# Create iOS project (one-time)
npx cap add ios
npx cap sync ios
```

### **Development Workflow:**
```bash
# 1. Make changes to your React app
npm run dev

# 2. Build for production
npm run build

# 3. Sync with iOS
npx cap sync ios

# 4. Push to trigger cloud build
git add .
git commit -m "Your changes"
git push
```

### **Testing on Device:**
```bash
# Open in Xcode (if your Mac can handle it)
npx cap open ios

# Or just push and use cloud build
git push
```

---

## 📱 Testing Your App

### **Install Methods:**
1. **Development Build:**
   - Download IPA from cloud build
   - Install via Xcode Devices window
   - Or use tools like 3uTools, iFunbox

2. **TestFlight (Recommended):**
   - Configure App Store Connect
   - Upload builds automatically
   - Share with beta testers

3. **Ad-hoc Distribution:**
   - Add device UDIDs to provisioning profile
   - Build with ad-hoc configuration

---

## 🔧 Troubleshooting

### **Common Issues:**

**Build Fails - Missing Certificates:**
```bash
# Solution: Add certificates to cloud service
# Or use automatic signing in Xcode project
```

**Environment Variables Not Working:**
```bash
# Check secrets are properly configured
# Verify .env.local is created in build
```

**Capacitor Sync Issues:**
```bash
# Clear and rebuild
rm -rf ios/
npx cap add ios
npx cap sync ios
```

**Bundle ID Conflicts:**
```bash
# Make sure bundle ID is unique
# Update in capacitor.config.ts and Xcode project
```

---

## 🚀 Next Steps

1. **Choose your platform** (GitHub Actions recommended)
2. **Follow setup steps** for your chosen platform
3. **Configure secrets/variables**
4. **Push code to trigger first build**
5. **Download and test** the generated IPA
6. **Set up TestFlight** for easy distribution

### **Pro Tips:**
- Start with GitHub Actions (free and reliable)
- Use TestFlight for beta testing
- Keep your Apple Developer account active
- Monitor build times and costs
- Set up notifications for build results

Need help with any specific step? Let me know! 🤝
