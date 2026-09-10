$ErrorActionPreference = 'Stop'
$packageRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$packageStage = Join-Path $packageRoot '.runner-package'
New-Item -ItemType Directory -Path $packageStage -Force | Out-Null
# Explicit allowlist: never package .env, local tokens, databases, logs or browser profiles.
Copy-Item -LiteralPath (Join-Path $packageRoot 'runner') -Destination $packageStage -Recurse -Force
Copy-Item -LiteralPath (Join-Path $packageRoot 'ups-browser-extension') -Destination $packageStage -Recurse -Force
$packageJson = '{"name":"speego-ups-runner","version":"0.4.2","private":true,"type":"module","engines":{"node":">=24"},"dependencies":{"@supabase/supabase-js":"2.112.4"}}'
[IO.File]::WriteAllText((Join-Path $packageStage 'package.json'), $packageJson)
Push-Location $packageStage
try {
  & npm.cmd install --package-lock-only --ignore-scripts
  if ($LASTEXITCODE -ne 0) { throw 'Could not prepare lockfile' }
} finally { Pop-Location }
$packageFiles = @('runner','ups-browser-extension','package.json','package-lock.json') | ForEach-Object { Join-Path $packageStage $_ }
Compress-Archive -LiteralPath $packageFiles -DestinationPath (Join-Path $packageRoot 'public\speego-runner.zip') -Force
Compress-Archive -Path (Join-Path $packageRoot 'ups-browser-extension\*') -DestinationPath (Join-Path $packageRoot 'public\ups-tracking-extension.zip') -Force
Write-Host 'Built public/speego-runner.zip and public/ups-tracking-extension.zip'
