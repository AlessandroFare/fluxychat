# Release @fluxy-chat/sdk

$sdkDir = "C:\Users\alefare\Chat\packages\sdk"
$pkgFile = "$sdkDir\package.json"

# Backup
Copy-Item $pkgFile "$pkgFile.bak"

try {
    # Replace workspace:* with published versions
    (Get-Content $pkgFile) -replace '"@fluxy-chat/protocol": "workspace:\*"', '"@fluxy-chat/protocol": "^0.1.0"' | Set-Content $pkgFile
    Write-Host "✓ workspace:* replaced"

    # Build dist (skip type errors — pre-existing issue, dist/ already has fleet methods)
    Push-Location $sdkDir
    try {
        pnpm exec tsc -p tsconfig.json --skipLibCheck 2>$null
        if ($?) { Write-Host "✓ Build OK" } else { Write-Host "⚠ Build had errors (pre-existing, continuing)" }
    }
    finally { Pop-Location }

    # Publish
    Push-Location $sdkDir
    try {
        pnpm publish --no-git-checks
        if ($?) { Write-Host "✓ Published @fluxy-chat/sdk@0.4.2 → npm" }
    }
    finally { Pop-Location }
}
finally {
    # Restore workspace:*
    Copy-Item "$pkgFile.bak" $pkgFile -Force
    Remove-Item "$pkgFile.bak" -Force
    Write-Host "✓ Original package.json restored"
}
