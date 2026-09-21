@echo off
setlocal
echo ===================================================
echo   Starting Smart Warehouse Web & WA Bot Service
echo ===================================================
echo.

where docker >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo Using Docker Compose...
    docker compose up -d --build
    goto done
)

where podman >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo Using Podman Compose...
    podman compose up -d --build
    goto done
)

if exist "C:\Users\%USERNAME%\AppData\Local\Programs\Podman\podman.exe" (
    echo Using Podman from AppData...
    set "PATH=C:\Users\%USERNAME%\AppData\Local\Programs\Podman;%PATH%"
    podman compose up -d --build
    goto done
)

echo [ERROR] Neither Docker nor Podman was found on your system!
echo Please install Docker Desktop or Podman to run the containers.
pause
exit /b 1

:done
echo.
echo ===================================================
echo   Services are running!
echo   - Web Application: http://localhost:3000
echo   - Bot Dashboard:   http://localhost:3001/dashboard
echo   - Bot API Server:  http://localhost:3001
echo ===================================================
echo.
pause
