# Remove schema prefixes from Supabase queries (Supabase REST API doesn't support them)
# The database has views in public schema that point to the actual schema tables

$schemas = @('users', 'events', 'ticketing', 'messaging', 'organizations', 'analytics', 'sponsorship', 'tickets', 'wallets', 'campaigns', 'payments', 'ml', 'ref')

Get-ChildItem -Path src -Recurse -Include *.ts,*.tsx | ForEach-Object {
    $content = Get-Content $_.FullName -Raw
    $modified = $false
    
    foreach ($schema in $schemas) {
        # Match .from('schema.table') or .from("schema.table")
        if ($content -match "\.from\([`"']$schema\.") {
            $content = $content -replace "\.from\('$schema\.([a-z_]+)'\)", ".from('`$1')"
            $content = $content -replace "\.from\(`"$schema\.([a-z_]+)`"\)", ".from(`"`$1`")"
            $modified = $true
        }
    }
    
    if ($modified) {
        Set-Content $_.FullName -Value $content -NoNewline
        Write-Host "Fixed: $($_.FullName)"
    }
}

Write-Host "`nDone! All Supabase queries now use public schema views."

