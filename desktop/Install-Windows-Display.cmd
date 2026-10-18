@echo off
setlocal
cd /d "%~dp0"
echo Installing optional Windows player display. Browser display needs no installation.
call npm ci --omit=dev
if errorlevel 1 (
  echo Installation failed. You can continue using Browser display.
  pause
  exit /b 1
)
node -e "require('electron')"
if errorlevel 1 (
  echo The optional display runtime could not be downloaded. Browser display still works.
  pause
  exit /b 1
)
echo Windows player display is ready. Refresh the DM page and select it under Player display.
pause
