# 🚀 Quick Azure DevOps Setup for YardPass iOS

## Step 1: Create Azure DevOps Organization
1. In Azure Portal, click **"Azure DevOps organizations"**
2. You'll be redirected to `dev.azure.com`
3. Click **"New organization"**
4. Name it: `YardPass-Builds`
5. Choose region closest to you

## Step 2: Create Project
1. Click **"New project"**
2. Name: `YardPass-iOS`
3. Visibility: **Private**
4. Click **"Create"**

## Step 3: Import Your Code
Choose one of these options:

### Option A: Import from GitHub (if you have it there)
1. Go to **Repos** → **Import repository**
2. Enter your GitHub URL
3. Import!

### Option B: Push from Local
```bash
# In your project directory
git remote add azure https://dev.azure.com/YardPass-Builds/YardPass-iOS/_git/YardPass-iOS
git push -u azure main
```

## Step 4: Set Up Variables
1. Go to **Pipelines** → **Library**
2. Click **"+ Variable group"**
3. Name: `YardPass-Secrets`
4. Add these variables (click "+ Add" for each):

```
VITE_SUPABASE_URL = https://yieslxnrfeqchbcmgavz.supabase.co
VITE_SUPABASE_ANON_KEY = [your_supabase_anon_key]
VITE_SUPABASE_FUNCTIONS_URL = https://yieslxnrfeqchbcmgavz.supabase.co/functions/v1
VITE_STRIPE_PUBLISHABLE_KEY = [your_stripe_key]
VITE_MAPBOX_ACCESS_TOKEN = [your_mapbox_key]
APPLE_TEAM_ID = [your_apple_team_id]
```

5. Click **"Save"**

## Step 5: Create Pipeline
1. Go to **Pipelines** → **Create Pipeline**
2. Choose **"Azure Repos Git"**
3. Select your repository
4. Choose **"Existing Azure Pipelines YAML file"**
5. Path: `/azure-pipelines.yml`
6. Click **"Continue"** then **"Save and run"**

## Step 6: First Build
Your first build will start automatically! 🎉

### Build Process:
- ⏱️ **Takes**: 10-15 minutes
- 💰 **Costs**: ~$1 from your $100 credit
- 📱 **Result**: iOS app (.ipa file) ready for testing

## Step 7: Download Your App
1. When build completes, go to build results
2. Click **"Artifacts"** tab
3. Download **"YardPass-iOS"** artifact
4. Extract the .ipa file
5. Install on your iOS device!

## 🆘 Need Your Keys?
You'll need these from your services:

### Supabase:
- Go to your Supabase project settings
- Copy the URL and anon key

### Stripe:
- Go to Stripe dashboard → Developers → API Keys
- Copy publishable key (starts with `pk_`)

### Mapbox:
- Go to Mapbox account → Access tokens
- Copy default public token

### Apple Team ID:
- Go to Apple Developer portal
- Account → Membership → Team ID

## 🎯 Next Steps After First Build:
1. **Test the app** on your device
2. **Set up TestFlight** for easier distribution
3. **Configure automatic builds** on code changes
4. **Add more team members** to test

Ready to start? Click **"Azure DevOps organizations"** in your Azure portal! 🚀
