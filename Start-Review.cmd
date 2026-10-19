@echo off
setlocal
cd /d "%~dp0"
set "PORT=5190"
set "TABLETOP_DATA=%~dp0data"
echo Tabletop Map 0.4.0 review - separate data and port 5190.
node server.js --open
pause
