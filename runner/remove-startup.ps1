$ErrorActionPreference = 'Stop'
Unregister-ScheduledTask -TaskName 'SpeeGo UPS Runner' -Confirm:$false
Write-Host 'Removed startup task. Queue and browser profiles are preserved.'
