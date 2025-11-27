# 🚀 Deploy Edge Functions - Quick Commands

## Deploy All Phase 2.1 Edge Functions

Run these commands in your terminal (PowerShell or Command Prompt):

```bash
# Navigate to project root (if not already there)
cd "C:\Users\Louis Cid\Yardpass 3.0\yardpass-upgrade"

# Deploy new Edge Functions
supabase functions deploy process-email-queue
supabase functions deploy process-webhook-retries

# Deploy updated Edge Functions
supabase functions deploy send-email
supabase functions deploy stripe-webhook
```

## Alternative: Deploy All at Once

If you want to deploy all functions in one go:

```bash
supabase functions deploy process-email-queue && supabase functions deploy process-webhook-retries && supabase functions deploy send-email && supabase functions deploy stripe-webhook
```

## Verify Deployment

After deploying, check in Supabase Dashboard:
- Go to **Edge Functions** section
- You should see all 4 functions listed as "Active"

## Troubleshooting

If you get authentication errors:
```bash
# Make sure you're linked to your project
supabase link --project-ref YOUR_PROJECT_REF

# Or login again
supabase login
```

