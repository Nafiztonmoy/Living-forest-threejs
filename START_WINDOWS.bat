@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found.
  echo Install Node.js LTS from https://nodejs.org/ and then run this file again.
  pause
  exit /b 1
)
echo Starting Forest 17...
npm start
pause
