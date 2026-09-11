@echo off
cd /d "%~dp0"

start "PocketBase" cmd /k "cd /d "%~dp0cigarette-screening-app\pb" && pocketbase.exe serve"

start "Vite Dev Server" cmd /k "cd /d "%~dp0cigarette-screening-app" && npm run dev"

timeout /t 3 /nobreak >nul
start http://localhost:5173/
