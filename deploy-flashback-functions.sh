#!/bin/bash

# Flashback Edge Functions Deployment Script
# Run this after: supabase login

echo "🚀 Deploying Flashback-Updated Edge Functions"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Set project reference
PROJECT_REF="yieslxnrfeqchbcmgavz"

echo "📦 Deploying posts-create..."
supabase functions deploy posts-create --project-ref $PROJECT_REF --no-verify-jwt

echo ""
echo "📦 Deploying home-feed..."
supabase functions deploy home-feed --project-ref $PROJECT_REF --no-verify-jwt

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Verify at:"
echo "https://supabase.com/dashboard/project/$PROJECT_REF/functions"
