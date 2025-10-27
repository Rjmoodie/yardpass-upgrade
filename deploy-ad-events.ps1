# Deploy ad-events Edge Function
$ErrorActionPreference = "Stop"

Write-Host "Deploying ad-events Edge Function..." -ForegroundColor Cyan

# Remove problematic .env.local temporarily if it exists
$envFile = "supabase\functions\.env.local"
$envBackup = $null
if (Test-Path $envFile) {
    $envBackup = "$envFile.backup"
    Write-Host "Backing up .env.local..." -ForegroundColor Yellow
    Move-Item $envFile $envBackup -Force
}

try {
    # Deploy
    npx supabase functions deploy ad-events --project-ref yieslxnrfeqchbcmgavz --no-verify-jwt
    Write-Host "✅ Deployment successful!" -ForegroundColor Green
}
finally {
    # Restore .env.local if we backed it up
    if ($envBackup -and (Test-Path $envBackup)) {
        Write-Host "Restoring .env.local..." -ForegroundColor Yellow
        Move-Item $envBackup $envFile -Force
    }
}

