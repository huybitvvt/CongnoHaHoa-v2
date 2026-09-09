@echo off
cd /d "%~dp0.."
node --version >nul 2>&1
if errorlevel 1 (
  echo Install Node.js 24 LTS, then run this file again.
  pause
  exit /b 1
)
if not exist ".env.runner" (
  copy "runner\runner.env.example" ".env.runner" >nul
  notepad ".env.runner"
  echo Fill the DESTINATION key, save and close Notepad, then press a key.
  pause
)
if not exist "node_modules\@supabase\supabase-js\package.json" (
  call npm.cmd ci --omit=dev
  if errorlevel 1 exit /b 1
)
node runner/service.mjs
pause
