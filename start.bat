@echo off
taskkill /F /IM electron.exe /T >nul 2>&1
taskkill /F /IM "Lex Cue Editor.exe" /T >nul 2>&1
:: Kill any node processes running from this project
for /f "tokens=2" %%a in ('wmic process where "CommandLine like '%%CueEditor%%' and Name='node.exe'" get ProcessId 2^>nul ^| findstr /r "[0-9]"') do taskkill /F /PID %%a >nul 2>&1
:: Kill anything on dev server ports
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":5173 :5174 :5175 "') do taskkill /F /PID %%a >nul 2>&1
timeout /t 1 /nobreak >nul
cd /d "%~dp0"
npm run dev
