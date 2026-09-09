@echo off
echo Starting News2PSD...
echo.

REM Refresh PATH to pick up Node.js
set "NODE_PATH=C:\Program Files\nodejs"
set "PATH=%NODE_PATH%;%PATH%"

REM Start backend
echo [1/2] Starting backend (port 3001)...
start "News2PSD Backend" cmd /k "cd /d "%~dp0server" && node src/index.js"

REM Wait a moment for backend to initialize
timeout /t 2 /nobreak >nul

REM Start frontend dev server
echo [2/2] Starting frontend (port 5173)...
start "News2PSD Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo ==========================================
echo  News2PSD is starting up!
echo  Open: http://localhost:5173
echo ==========================================
echo.
pause
