$ErrorActionPreference = 'Stop'
$runnerRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$runnerNode = (Get-Command node.exe).Source
$runnerService = Join-Path $runnerRoot 'runner\service.mjs'
if (-not (Test-Path -LiteralPath (Join-Path $runnerRoot '.env.runner'))) { throw 'Run runner\start.cmd and configure .env.runner first.' }
$runnerIdentity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$runnerAction = New-ScheduledTaskAction -Execute $runnerNode -Argument ('"' + $runnerService + '"') -WorkingDirectory $runnerRoot
$runnerTrigger = New-ScheduledTaskTrigger -AtLogOn -User $runnerIdentity
$runnerPrincipal = New-ScheduledTaskPrincipal -UserId $runnerIdentity -LogonType Interactive -RunLevel Limited
$runnerSettings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
Register-ScheduledTask -TaskName 'SpeeGo UPS Runner' -Action $runnerAction -Trigger $runnerTrigger -Principal $runnerPrincipal -Settings $runnerSettings -Description 'SpeeGo UPS coordinator: restart on failure; requires an interactive desktop.' -Force | Out-Null
Write-Host 'Installed: SpeeGo UPS Runner. Starts at Windows sign-in, restarts on process failure. Disable sleep separately in Windows Settings.'
