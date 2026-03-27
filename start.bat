@echo off
taskkill /F /IM electron.exe /T >nul 2>&1
taskkill /F /IM "Lex Cue Editor.exe" /T >nul 2>&1
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 \|:5174 \|:5175 "') do taskkill /F /PID %%a >nul 2>&1
cd /d "%~dp0"
npm run dev
